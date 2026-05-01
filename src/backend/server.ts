import { schema } from '../../db/schema';
import { AnalyzePage } from '../frontend/react/pages/AnalyzePage';

import { DashboardIndex } from '../frontend/react/pages/DashboardIndex';
import {
	probeUrl,
	trackUrl
} from './handlers/analyzeHandlers';
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

const pool = new SQL(process.env.DATABASE_URL || 'postgresql://user:password@localhost:5433/database');
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

const analyzeBody = t.Object({
	url: t.String({ format: 'uri' })
});

const trackBody = t.Object({
	url: t.String({ format: 'uri' }),
	projectId: t.Optional(t.String({ format: 'uuid' })),
	newProjectName: t.Optional(t.String({ minLength: 1, maxLength: 120 }))
});

const renderDashboard = async (selectedProjectId?: string) => {
	const data = await getDashboardData(db);
	return handleReactPageRequest({
		Page: DashboardIndex,
		index: asset(manifest, 'DashboardIndexIndex'),
		props: { data, selectedProjectId, cssPath: undefined }
	});
};

const renderAnalyze = async () =>
	handleReactPageRequest({
		Page: AnalyzePage,
		index: asset(manifest, 'AnalyzePageIndex'),
		props: { cssPath: undefined }
	});

const dashboardQuery = t.Object({
	projectId: t.Optional(t.String({ format: 'uuid' }))
});

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
	.post(
		'/api/analyze',
		async ({ body }) => probeUrl(body.url),
		{ body: analyzeBody }
	)
	.post(
		'/api/track-url',
		async ({ body, set }) => {
			const result = await trackUrl(db, body.url, {
				projectId: body.projectId,
				newProjectName: body.newProjectName
			});
			if ('error' in result) {
				set.status = result.error === 'project not found' ? 404 : 400;
				return result;
			}
			return result;
		},
		{ body: trackBody }
	)
	.get(
		'/api/status/fragment',
		async ({ query, set }) => {
			set.headers['content-type'] = 'text/html; charset=utf-8';
			return getStatusFragment(db, query.projectId);
		},
		{
			query: t.Object({
				projectId: t.Optional(t.String())
			})
		}
	)
	.get('/', ({ query }) => renderDashboard(query.projectId), {
		query: dashboardQuery
	})
	.get('/dashboard', ({ query }) => renderDashboard(query.projectId), {
		query: dashboardQuery
	})
	.get('/analyze', () => renderAnalyze())
	.get('/status', () => handleHTMXPageRequest(asset(manifest, 'StatusPage')))
	.use(networking)
	.on('error', (err) => {
		const { request } = err;
		console.error(
			`Server error on ${request.method} ${request.url}: ${err.message}`
		);
	});

export type Server = typeof server;
