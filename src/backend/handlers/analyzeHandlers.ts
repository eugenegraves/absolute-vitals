import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import type { Browser } from 'playwright';
import { schema, type SchemaType } from '../../../db/schema';

type Db = BunSQLDatabase<SchemaType>;

export type AnalyzeResult = {
	url: string;
	ttfbMs: number;
	lcpMs: number | null;
	fcpMs: number | null;
	inpMs: number | null;
	cls: number | null;
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

const TIMEOUT_MS = 30_000;
const USER_AGENT = 'AbsoluteVitals-Probe/1.0';

const WEB_VITALS_IIFE = readFileSync(
	resolve(
		process.cwd(),
		'node_modules/web-vitals/dist/web-vitals.iife.js'
	),
	'utf-8'
);

const REPORTER_SCRIPT = `${WEB_VITALS_IIFE}
;(function() {
	if (typeof webVitals === 'undefined') return;
	const send = (name) => (m) => {
		if (typeof window.__abReportVital === 'function') {
			try { window.__abReportVital(name, m.value); } catch (e) {}
		}
	};
	webVitals.onLCP(send('lcp'), { reportAllChanges: true });
	webVitals.onFCP(send('fcp'));
	webVitals.onTTFB(send('ttfb'));
	webVitals.onCLS(send('cls'), { reportAllChanges: true });
	webVitals.onINP(send('inp'), { reportAllChanges: true });
})();`;

const errorResult = (rawUrl: string, message: string): AnalyzeResult => ({
	url: rawUrl,
	ttfbMs: 0,
	lcpMs: null,
	fcpMs: null,
	inpMs: null,
	cls: null,
	totalMs: 0,
	statusCode: 0,
	ok: false,
	bodyBytes: 0,
	contentEncoding: null,
	contentType: null,
	title: null,
	description: null,
	fetchedAt: Date.now(),
	error: message
});

export const probeUrl = async (rawUrl: string): Promise<AnalyzeResult> => {
	const fetchedAt = Date.now();
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return errorResult(rawUrl, 'invalid url');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return errorResult(rawUrl, 'only http and https urls are supported');
	}

	let browser: Browser | null = null;
	const t0 = Date.now();

	try {
		const pwMod = 'playwright';
		const pw = await import(pwMod);
		browser = await pw.chromium.launch({ headless: true });
		const context = await browser.newContext({
			ignoreHTTPSErrors: true,
			viewport: { width: 1280, height: 800 }
		});
		const page = await context.newPage();

		const metrics: Record<string, number> = {};
		await page.exposeFunction(
			'__abReportVital',
			(name: string, value: number) => {
				if (typeof value === 'number' && Number.isFinite(value)) {
					metrics[name] = value;
				}
			}
		);

		await page.addInitScript({ content: REPORTER_SCRIPT });

		const response = await page.goto(parsed.toString(), {
			waitUntil: 'load',
			timeout: TIMEOUT_MS
		});

		if (!response) {
			throw new Error('no response');
		}

		const statusCode = response.status();
		const headers = response.headers();
		const contentType = headers['content-type'] ?? null;
		const contentEncoding = headers['content-encoding'] ?? null;

		let bodyBytes = 0;
		try {
			const body = await response.body();
			bodyBytes = body.byteLength;
		} catch {
			/* not always available — keep 0 */
		}

		try {
			await page.click('body', { timeout: 1500, force: true });
		} catch {
			/* page may not be interactable; INP just stays null */
		}

		await page.waitForTimeout(2500);

		await page.evaluate(() => {
			window.dispatchEvent(new Event('pagehide'));
			document.dispatchEvent(new Event('visibilitychange'));
		});

		await page.waitForTimeout(800);

		const title = (await page.title().catch(() => '')) || null;
		const description = await page
			.evaluate(() => {
				const m = document.querySelector('meta[name="description"]');
				const value = m?.getAttribute('content')?.trim();
				return value && value.length > 0 ? value.slice(0, 500) : null;
			})
			.catch(() => null);

		const totalMs = Date.now() - t0;

		return {
			url: response.url(),
			ttfbMs: metrics.ttfb !== undefined ? Math.round(metrics.ttfb) : 0,
			lcpMs: metrics.lcp !== undefined ? Math.round(metrics.lcp) : null,
			fcpMs: metrics.fcp !== undefined ? Math.round(metrics.fcp) : null,
			inpMs: metrics.inp !== undefined ? Math.round(metrics.inp) : null,
			cls:
				metrics.cls !== undefined
					? Number(metrics.cls.toFixed(4))
					: null,
			totalMs,
			statusCode,
			ok: statusCode >= 200 && statusCode < 400,
			bodyBytes,
			contentEncoding,
			contentType,
			title: title ? title.slice(0, 300) : null,
			description,
			fetchedAt
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const reason = message.toLowerCase().includes('timeout')
			? 'request timed out'
			: message;
		return {
			...errorResult(rawUrl, reason),
			fetchedAt,
			totalMs: Date.now() - t0
		};
	} finally {
		await browser?.close().catch(() => undefined);
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
		const origin = `${parsed.protocol}//${parsed.host}`;
		const [existing] = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				apiKey: schema.projects.apiKey
			})
			.from(schema.projects)
			.where(eq(schema.projects.origin, origin))
			.limit(1);

		if (existing) {
			projectId = existing.id;
			projectName = existing.name;
			apiKey = existing.apiKey;
			created = false;
		} else {
			const name =
				options.newProjectName?.trim() ||
				parsed.hostname ||
				'New project';
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
	}

	const result = await probeUrl(rawUrl);
	const recordedAt = new Date(result.fetchedAt);

	if (result.error === undefined && result.statusCode > 0) {
		const baseEvent = {
			projectId,
			url: result.url,
			userAgent: USER_AGENT,
			recordedAt
		};
		const numericMetrics: Array<{
			metric: 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls';
			value: number | null;
		}> = [
			{ metric: 'ttfb', value: result.ttfbMs },
			{ metric: 'lcp', value: result.lcpMs },
			{ metric: 'fcp', value: result.fcpMs },
			{ metric: 'inp', value: result.inpMs },
			{ metric: 'cls', value: result.cls }
		];
		for (const { metric, value } of numericMetrics) {
			if (value === null) continue;
			await db
				.insert(schema.events)
				.values({ ...baseEvent, metric, value });
		}
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
		recordedAt
	});

	return { projectId, projectName, apiKey, created, result };
};
