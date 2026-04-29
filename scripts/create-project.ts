import { randomBytes } from 'node:crypto';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { schema } from '../db/schema';

type Args = { name?: string; origin?: string };

const parseArgs = (argv: string[]): Args => {
	const out: Args = {};
	for (const arg of argv.slice(2)) {
		const m = arg.match(/^--([^=]+)=(.*)$/);
		if (!m) continue;
		const [, k, v] = m;
		if (k === 'name') out.name = v;
		if (k === 'origin') out.origin = v;
	}
	return out;
};

const main = async () => {
	const { name, origin } = parseArgs(process.argv);
	if (!name || !origin) {
		console.error(
			'usage: bun scripts/create-project.ts --name=Demo --origin=https://example.com'
		);
		process.exit(1);
	}

	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('DATABASE_URL is not set');
		process.exit(1);
	}

	const apiKey = randomBytes(24).toString('base64url');

	const pool = new SQL(url);
	const db = drizzle(pool, { schema });

	const [project] = await db
		.insert(schema.projects)
		.values({ name, origin, apiKey })
		.returning({
			id: schema.projects.id,
			name: schema.projects.name,
			origin: schema.projects.origin,
			apiKey: schema.projects.apiKey
		});

	if (!project) {
		console.error('insert returned no row');
		process.exit(1);
	}

	console.log(JSON.stringify(project, null, 2));
	console.log(`\nexport KEY="${project.apiKey}"`);
	console.log(`export PROJECT_ID="${project.id}"`);

	await pool.end();
};

await main();
