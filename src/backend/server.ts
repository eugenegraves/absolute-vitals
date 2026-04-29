import { schema } from '../../db/schema';
import { DashboardIndex } from '../frontend/react/pages/DashboardIndex';
import {
	getDashboardData
} from './handlers/dashboardHandlers';
import {
	insertEvent,
	validateApiKey
} from './handlers/ingestHandlers';
import { getStatusFragment } from './handlers/statusHandlers';
import {
	asset,
	getEnv,
	handleHTMXPageRequest,
	networking,
	prepare
} from '@absolutejs/absolute';
import { handleReactPageRequest } from '@absolutejs/absolute/react';
import { swagger } from '@elysiajs/swagger';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { Elysia, t } from 'elysia';

const { absolutejs, manifest } = await prepare();

const pool = new SQL(getEnv('DATABASE_URL'));
const db = drizzle(pool, { schema });

const ingestBody = t.Object({
	metric: t.Union([
		t.Literal('lcp'),
		t.Literal('fcp'),
		t.Literal('ttfb'),
		t.Literal('inp'),
		t.Literal('cls'),
		t.Literal('uptime')
	]),
	value: t.Number(),
	url: t.String({ format: 'uri' }),
	statusCode: t.Optional(t.Number()),
	ok: t.Optional(t.Boolean()),
	userAgent: t.Optional(t.String()),
	timestamp: t.Optional(t.Number())
});

const ingestHeaders = t.Object({
	'x-api-key': t.String({ minLength: 16 })
});

const renderDashboard = async () => {
	const data = await getDashboardData(db);
	return handleReactPageRequest(
		DashboardIndex,
		asset(manifest, 'DashboardIndexIndex'),
		{ data, cssPath: undefined }
	);
};

const server = new Elysia()
	.use(absolutejs)
	.use(swagger())
	.post(
		'/api/ingest',
		async ({ headers, body, set }) => {
			const project = await validateApiKey(db, headers['x-api-key']);
			if (!project) {
				set.status = 401;
				return { error: 'invalid api key' };
			}
			await insertEvent(db, project.id, body);
			set.status = 202;
			return { ok: true };
		},
		{ body: ingestBody, headers: ingestHeaders }
	)
	.get(
		'/api/status/fragment',
		async ({ query, set }) => {
			set.headers['content-type'] = 'text/html; charset=utf-8';
			return getStatusFragment(db, query.projectId);
		},
		{
			query: t.Object({
				projectId: t.String({ format: 'uuid' })
			})
		}
	)
	.get('/', () => renderDashboard())
	.get('/dashboard', () => renderDashboard())
	.get('/status', () => handleHTMXPageRequest(asset(manifest, 'StatusPage')))
	.use(networking)
	.on('error', (err) => {
		const { request } = err;
		console.error(
			`Server error on ${request.method} ${request.url}: ${err.message}`
		);
	});

export type Server = typeof server;
