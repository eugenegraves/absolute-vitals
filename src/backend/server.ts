import { schema } from '../../db/schema';
import { ReactExample } from '../frontend/react/pages/ReactExample';
import {
	createCountHistory,
	getCountHistory
} from './handlers/countHistoryHandlers';
import {
	asset,
	getEnv,
	handleHTMXPageRequest,
	handleReactPageRequest,
	networking,
	prepare
} from '@absolutejs/absolute';
import { swagger } from '@elysiajs/swagger';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { Elysia, t } from 'elysia';
import { scopedState } from 'elysia-scoped-state';

const { absolutejs, manifest } = await prepare();

const pool = new SQL(getEnv('DATABASE_URL'));
const db = drizzle(pool, { schema });

const server = new Elysia()
	.use(absolutejs)
	.use(swagger())
	.use(scopedState({ count: { value: 0 } }))
	.get('/', () =>
		handleReactPageRequest(
			ReactExample,
			asset(manifest, 'ReactExampleIndex'),
			{ initialCount: 0, cssPath: asset(manifest, 'ReactExampleCSS') }
		)
	)
	.get('/react', () =>
		handleReactPageRequest(
			ReactExample,
			asset(manifest, 'ReactExampleIndex'),
			{ initialCount: 0, cssPath: asset(manifest, 'ReactExampleCSS') }
		)
	)
	.get('/htmx', () => handleHTMXPageRequest(asset(manifest, 'HTMXExample')))
	.post('/htmx/reset', ({ resetScopedStore }) => resetScopedStore())
	.get('/htmx/count', ({ scopedStore }) => scopedStore.count)
	.post('/htmx/increment', ({ scopedStore }) => ++scopedStore.count)
	.get('/count/:uid', ({ params: { uid } }) => getCountHistory(db, uid), {
		params: t.Object({ uid: t.Number() })
	})
	.post('/count', ({ body: { count } }) => createCountHistory(db, count), {
		body: t.Object({ count: t.Number() })
	})
	.use(networking)
	.on('error', (err) => {
		const { request } = err;
		console.error(
			`Server error on ${request.method} ${request.url}: ${err.message}`
		);
	});

export type Server = typeof server;
