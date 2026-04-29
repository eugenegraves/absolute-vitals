import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { schema, type SchemaType } from '../../../db/schema';
import type { MetricKind } from './ingestHandlers';

type Db = BunSQLDatabase<SchemaType>;

export type VitalsChartPoint = { t: number; value: number };

export type MetricSummary = {
	p50: number | null;
	p75: number | null;
	p95: number | null;
	count: number;
	recent: VitalsChartPoint[];
};

export type UptimeSummary = {
	okRate15m: number | null;
	lastPingAt: number | null;
	totalPings15m: number;
};

export type ProjectDashboard = {
	id: string;
	name: string;
	origin: string;
	perMetric: Record<Exclude<MetricKind, 'uptime'>, MetricSummary>;
	uptime: UptimeSummary;
};

export type DashboardData = {
	projects: ProjectDashboard[];
	totalEvents24h: number;
	generatedAt: number;
};

const CWV_METRICS = ['lcp', 'fcp', 'ttfb', 'inp', 'cls'] as const;
const RECENT_LIMIT = 50;

const emptyMetric = (): MetricSummary => ({
	p50: null,
	p75: null,
	p95: null,
	count: 0,
	recent: []
});

const getMetricSummary = async (
	db: Db,
	projectId: string,
	metric: Exclude<MetricKind, 'uptime'>,
	since: Date
): Promise<MetricSummary> => {
	const [agg] = await db
		.select({
			count: sql<number>`count(*)::int`,
			p50: sql<
				number | null
			>`percentile_cont(0.5) within group (order by ${schema.events.value})`,
			p75: sql<
				number | null
			>`percentile_cont(0.75) within group (order by ${schema.events.value})`,
			p95: sql<
				number | null
			>`percentile_cont(0.95) within group (order by ${schema.events.value})`
		})
		.from(schema.events)
		.where(
			and(
				eq(schema.events.projectId, projectId),
				eq(schema.events.metric, metric),
				gte(schema.events.recordedAt, since)
			)
		);

	const recentRows = await db
		.select({
			value: schema.events.value,
			recordedAt: schema.events.recordedAt
		})
		.from(schema.events)
		.where(
			and(
				eq(schema.events.projectId, projectId),
				eq(schema.events.metric, metric),
				gte(schema.events.recordedAt, since)
			)
		)
		.orderBy(desc(schema.events.recordedAt))
		.limit(RECENT_LIMIT);

	const recent: VitalsChartPoint[] = recentRows
		.map((r) => ({ t: r.recordedAt.getTime(), value: r.value }))
		.reverse();

	return {
		count: agg?.count ?? 0,
		p50: agg?.p50 ?? null,
		p75: agg?.p75 ?? null,
		p95: agg?.p95 ?? null,
		recent
	};
};

const getUptimeSummary = async (
	db: Db,
	projectId: string,
	since: Date
): Promise<UptimeSummary> => {
	const rows = await db
		.select({
			ok: schema.events.ok,
			recordedAt: schema.events.recordedAt
		})
		.from(schema.events)
		.where(
			and(
				eq(schema.events.projectId, projectId),
				eq(schema.events.metric, 'uptime'),
				gte(schema.events.recordedAt, since)
			)
		);

	const total = rows.length;
	const okCount = rows.filter((r) => r.ok === true).length;
	const okRate15m = total === 0 ? null : okCount / total;
	const lastPingAt = rows.reduce<number | null>((acc, r) => {
		const t = r.recordedAt.getTime();
		return acc === null || t > acc ? t : acc;
	}, null);

	return { okRate15m, totalPings15m: total, lastPingAt };
};

export const getDashboardData = async (db: Db): Promise<DashboardData> => {
	const projects = await db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			origin: schema.projects.origin
		})
		.from(schema.projects)
		.orderBy(schema.projects.createdAt);

	const since24h = new Date(Date.now() - 24 * 60 * 60_000);
	const since15m = new Date(Date.now() - 15 * 60_000);

	const result: ProjectDashboard[] = [];
	for (const p of projects) {
		const perMetric = {} as ProjectDashboard['perMetric'];
		for (const m of CWV_METRICS) {
			perMetric[m] = await getMetricSummary(db, p.id, m, since24h).catch(
				() => emptyMetric()
			);
		}
		const uptime = await getUptimeSummary(db, p.id, since15m);
		result.push({ ...p, perMetric, uptime });
	}

	const [totals] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(schema.events)
		.where(gte(schema.events.recordedAt, since24h));

	return {
		projects: result,
		totalEvents24h: totals?.count ?? 0,
		generatedAt: Date.now()
	};
};
