import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { schema, type SchemaType } from '../../../db/schema';

type Db = BunSQLDatabase<SchemaType>;

export type AnalyzeResult = {
	url: string;
	ttfbMs: number;
	totalMs: number;
	statusCode: number;
	ok: boolean;
	bodyBytes: number;
	contentEncoding: string | null;
	contentType: string | null;
	title: string | null;
	description: string | null;
	fetchedAt: number;
	error?: string;
};

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2_000_000;
const USER_AGENT = 'AbsoluteVitals-Probe/1.0';

const decodeEntities = (s: string) =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');

const extractTitle = (html: string): string | null => {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (!match) return null;
	const value = match[1]?.trim() ?? '';
	return value.length > 0 ? decodeEntities(value).slice(0, 300) : null;
};

const extractDescription = (html: string): string | null => {
	const re =
		/<meta\b[^>]*\bname\s*=\s*['"]description['"][^>]*\bcontent\s*=\s*['"]([^'"]*)['"]/i;
	const reReversed =
		/<meta\b[^>]*\bcontent\s*=\s*['"]([^'"]*)['"][^>]*\bname\s*=\s*['"]description['"]/i;
	const match = html.match(re) ?? html.match(reReversed);
	if (!match) return null;
	const value = match[1]?.trim() ?? '';
	return value.length > 0 ? decodeEntities(value).slice(0, 500) : null;
};

export const probeUrl = async (rawUrl: string): Promise<AnalyzeResult> => {
	const fetchedAt = Date.now();
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return {
			url: rawUrl,
			ttfbMs: 0,
			totalMs: 0,
			statusCode: 0,
			ok: false,
			bodyBytes: 0,
			contentEncoding: null,
			contentType: null,
			title: null,
			description: null,
			fetchedAt,
			error: 'invalid url'
		};
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return {
			url: rawUrl,
			ttfbMs: 0,
			totalMs: 0,
			statusCode: 0,
			ok: false,
			bodyBytes: 0,
			contentEncoding: null,
			contentType: null,
			title: null,
			description: null,
			fetchedAt,
			error: 'only http and https urls are supported'
		};
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const t0 = performance.now();
		const res = await fetch(parsed, {
			signal: controller.signal,
			redirect: 'follow',
			headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' }
		});
		const ttfbMs = performance.now() - t0;

		const contentType = res.headers.get('content-type');
		let bodyBytes = 0;
		let bodyText = '';
		const reader = res.body?.getReader();
		if (reader) {
			const decoder = new TextDecoder('utf-8', { fatal: false });
			let truncated = false;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (!value) continue;
				bodyBytes += value.byteLength;
				if (!truncated) {
					if (bodyBytes <= MAX_BODY_BYTES) {
						bodyText += decoder.decode(value, { stream: true });
					} else {
						const allow = Math.max(0, MAX_BODY_BYTES - (bodyBytes - value.byteLength));
						if (allow > 0) {
							bodyText += decoder.decode(value.subarray(0, allow), {
								stream: true
							});
						}
						truncated = true;
						await reader.cancel().catch(() => undefined);
						break;
					}
				}
			}
		}
		const totalMs = performance.now() - t0;

		const isHtml = (contentType ?? '').toLowerCase().includes('text/html');
		const title = isHtml ? extractTitle(bodyText) : null;
		const description = isHtml ? extractDescription(bodyText) : null;

		return {
			url: parsed.toString(),
			ttfbMs: Math.round(ttfbMs),
			totalMs: Math.round(totalMs),
			statusCode: res.status,
			ok: res.ok,
			bodyBytes,
			contentEncoding: res.headers.get('content-encoding'),
			contentType,
			title,
			description,
			fetchedAt
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const reason =
			controller.signal.aborted && message.toLowerCase().includes('abort')
				? 'request timed out'
				: message;
		return {
			url: rawUrl,
			ttfbMs: 0,
			totalMs: 0,
			statusCode: 0,
			ok: false,
			bodyBytes: 0,
			contentEncoding: null,
			contentType: null,
			title: null,
			description: null,
			fetchedAt,
			error: reason
		};
	} finally {
		clearTimeout(timeout);
	}
};

export type TrackResult = {
	projectId: string;
	projectName: string;
	apiKey: string;
	created: boolean;
	result: AnalyzeResult;
};

export type TrackError = { error: string };

export const trackUrl = async (
	db: Db,
	rawUrl: string,
	options: { projectId?: string; newProjectName?: string }
): Promise<TrackResult | TrackError> => {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { error: 'invalid url' };
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { error: 'only http and https urls are supported' };
	}

	let projectId: string;
	let projectName: string;
	let apiKey: string;
	let created = false;

	if (options.projectId) {
		const [existing] = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				apiKey: schema.projects.apiKey
			})
			.from(schema.projects)
			.where(eq(schema.projects.id, options.projectId))
			.limit(1);
		if (!existing) return { error: 'project not found' };
		projectId = existing.id;
		projectName = existing.name;
		apiKey = existing.apiKey;
	} else {
		const name =
			options.newProjectName?.trim() ||
			parsed.hostname ||
			'New project';
		const origin = `${parsed.protocol}//${parsed.host}`;
		const newApiKey = randomBytes(24).toString('base64url');
		const [inserted] = await db
			.insert(schema.projects)
			.values({ name, origin, apiKey: newApiKey })
			.returning({
				id: schema.projects.id,
				name: schema.projects.name,
				apiKey: schema.projects.apiKey
			});
		if (!inserted) return { error: 'failed to create project' };
		projectId = inserted.id;
		projectName = inserted.name;
		apiKey = inserted.apiKey;
		created = true;
	}

	const result = await probeUrl(rawUrl);

	if (result.error === undefined && result.statusCode > 0) {
		await db.insert(schema.events).values({
			projectId,
			metric: 'ttfb',
			value: result.ttfbMs,
			url: result.url,
			userAgent: USER_AGENT,
			recordedAt: new Date(result.fetchedAt)
		});
	}
	await db.insert(schema.events).values({
		projectId,
		metric: 'uptime',
		value: result.totalMs,
		url: result.url,
		statusCode: result.statusCode || null,
		ok:
			result.statusCode >= 200 && result.statusCode < 400 ? true : false,
		userAgent: USER_AGENT,
		recordedAt: new Date(result.fetchedAt)
	});

	return { projectId, projectName, apiKey, created, result };
};
