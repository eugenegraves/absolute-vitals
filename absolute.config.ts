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
		reactDirectory: 'src/frontend/react',
		// Workaround for Bun minifier identifier-collision bug
		// (https://github.com/oven-sh/bun/issues/28742) that otherwise
		// crashes React 19's scheduler with `dU is not a function`.
		// Keeps whitespace + syntax minification, disables identifier mangling.
		bunBuild: {
			default: {
				minify: {
					whitespace: true,
					syntax: true,
					identifiers: false
				}
			}
		}
	}
});
