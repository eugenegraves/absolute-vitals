import {
	pgTable,
	uuid,
	varchar,
	text,
	doublePrecision,
	integer,
	boolean,
	timestamp,
	index,
	pgEnum
} from 'drizzle-orm/pg-core';

export const metricKind = pgEnum('metric_kind', [
	'lcp',
	'fcp',
	'ttfb',
	'inp',
	'cls',
	'uptime'
]);

export const projects = pgTable('projects', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 120 }).notNull(),
	origin: varchar('origin', { length: 255 }).notNull(),
	apiKey: varchar('api_key', { length: 64 }).notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true })
		.defaultNow()
		.notNull()
});

export const events = pgTable(
	'events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		metric: metricKind('metric').notNull(),
		value: doublePrecision('value').notNull(),
		url: text('url').notNull(),
		statusCode: integer('status_code'),
		ok: boolean('ok'),
		userAgent: text('user_agent'),
		recordedAt: timestamp('recorded_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(t) => ({
		projectTimeIdx: index('events_project_time_idx').on(
			t.projectId,
			t.recordedAt
		),
		projectMetricTimeIdx: index('events_project_metric_time_idx').on(
			t.projectId,
			t.metric,
			t.recordedAt
		)
	})
);

export const schema = { projects, events, metricKind };
export type SchemaType = typeof schema;
