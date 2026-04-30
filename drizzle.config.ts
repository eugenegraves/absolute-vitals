import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5433/database';

export default defineConfig({
	dialect: 'postgresql',
	schema: './db/schema.ts',
	out: './db/migrations',
	dbCredentials: { url }
});
