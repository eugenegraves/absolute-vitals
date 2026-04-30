import { defineConfig } from '@absolutejs/absolute';

export default defineConfig({
	db: {
		kind: 'command',
		command: ['docker', 'compose', '-p', 'postgresql', '-f', 'db/docker-compose.db.yml', 'up', 'db'],
		shutdown: ['docker', 'compose', '-p', 'postgresql', '-f', 'db/docker-compose.db.yml', 'down'],
		ready: {
			type: 'tcp',
			port: 5433
		},
		port: 5433
	},
	app: {
		entry: 'src/backend/server.ts',
		dependsOn: ['db'],
		assetsDirectory: 'src/backend/assets',
		buildDirectory: 'build',
		htmxDirectory: 'src/frontend/htmx',
		islands: {
			bootstrap: 'src/frontend/react/client/Bootstrap.tsx',
			registry: 'src/frontend/react/islands/registry.ts'
		},
		publicDirectory: 'public',
		reactDirectory: 'src/frontend/react'
	}
});
