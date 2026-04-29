import { and, eq, gte } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { schema, type SchemaType } from '../../../db/schema';

type Db = BunSQLDatabase<SchemaType>;

const escapeHtml = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) =>
			(({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			}) as Record<string, string>)[c]!
	);

export const getStatusFragment = async (db: Db, projectId: string) => {
	const since = new Date(Date.now() - 15 * 60_000);
	const rows = await db
		.select({ ok: schema.events.ok })
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
	const okRate = total === 0 ? null : okCount / total;
	const operational = okRate !== null && okRate >= 0.95;

	const cls = operational
		? 'bg-emerald-500'
		: okRate === null
			? 'bg-slate-400'
			: 'bg-red-500';
	const label = operational
		? 'ALL SYSTEMS OPERATIONAL'
		: okRate === null
			? 'NO RECENT DATA'
			: 'DEGRADED';
	const ratePct = okRate === null ? '—' : `${(okRate * 100).toFixed(1)}%`;
	const checkedAt = new Date().toISOString();

	return `<div class="flex items-center gap-3 text-white p-4 rounded-lg shadow ${cls}">
	<span class="h-3 w-3 rounded-full bg-white animate-pulse"></span>
	<span class="font-semibold tracking-wide">${escapeHtml(label)}</span>
	<span class="ml-auto text-xs opacity-90">${escapeHtml(ratePct)} ok over 15 min · ${total} pings · checked ${escapeHtml(checkedAt)}</span>
</div>`;
};
