import { defineConfig } from '@absolutejs/absolute';

export default defineConfig({
	assetsDirectory: 'src/backend/assets',
	buildDirectory: 'build',
	htmxDirectory: 'src/frontend/htmx',
	islands: { registry: 'src/frontend/react/islands/registry.ts' },
	publicDirectory: 'public',
	reactDirectory: 'src/frontend/react'
});
