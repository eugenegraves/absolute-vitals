import { defineConfig } from '@absolutejs/absolute';

export default defineConfig({
	assetsDirectory: 'src/backend/assets',
	buildDirectory: 'build',
	htmxDirectory: 'src/frontend/htmx',
	islands: {
		bootstrap: 'src/frontend/react/client/Bootstrap.tsx',
		registry: 'src/frontend/react/islands/registry.ts'
	},
	publicDirectory: 'public',
	reactDirectory: 'src/frontend/react'
});
