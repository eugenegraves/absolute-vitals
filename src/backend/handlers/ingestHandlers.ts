import { eq } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { schema, type SchemaType } from '../../../db/schema';

type Db = BunSQLDatabase<SchemaType>;

export type MetricKind = 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls' | 'uptime';

export type IngestPayload = {
	metric: MetricKind;
	value: number;
	url: string;
	statusCode?: number;
	ok?: boolean;
	userAgent?: string;
	timestamp?: number;
};

export const validateApiKey = async (db: Db, apiKey: string) => {
	const [project] = await db
		.select({ id: schema.projects.id })
		.from(schema.projects)
		.where(eq(schema.projects.apiKey, apiKey))
		.limit(1);
	return project ?? null;
};

export const insertEvent = async (
	db: Db,
	projectId: string,
	payload: IngestPayload
) => {
	const recordedAt = payload.timestamp
		? new Date(payload.timestamp)
		: new Date();
	await db.insert(schema.events).values({
		projectId,
		metric: payload.metric,
		value: payload.value,
		url: payload.url,
		statusCode: payload.statusCode ?? null,
		ok: payload.ok ?? null,
		userAgent: payload.userAgent ?? null,
		recordedAt
	});
};
