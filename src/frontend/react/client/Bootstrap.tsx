import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

type IslandManifest = Record<string, string>;

type IslandWindow = Window & {
	__ABSOLUTE_MANIFEST__?: IslandManifest;
	__REACT_ROOT__?: unknown;
};

const win = window as IslandWindow;

const hydrateIsland = async (el: HTMLElement) => {
	const component = el.dataset.component;
	const framework = el.dataset.framework;
	if (framework !== 'react' || !component) return;

	const manifest = win.__ABSOLUTE_MANIFEST__;
	if (!manifest) return;

	const key = `IslandReact${component}`;
	const path = manifest[key];
	if (!path) return;

	try {
		const mod = await import(/* @vite-ignore */ path);
		const Component = mod.default ?? mod[component];
		if (!Component) return;
		const propsRaw = el.dataset.props ?? '{}';
		const props = JSON.parse(propsRaw);
		const root = createRoot(el);
		root.render(createElement(Component, props));
	} catch (err) {
		console.error(`[islands] failed to hydrate ${component}:`, err);
	}
};

const waitForPageHydration = (callback: () => void) => {
	let attempts = 0;
	const tick = () => {
		attempts += 1;
		if (win.__REACT_ROOT__ || attempts > 240) {
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					callback();
				})
			);
			return;
		}
		requestAnimationFrame(tick);
	};
	tick();
};

const start = () => {
	const elements = document.querySelectorAll<HTMLElement>(
		'[data-island="true"]'
	);
	elements.forEach((el) => {
		void hydrateIsland(el);
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () =>
		waitForPageHydration(start)
	);
} else {
	waitForPageHydration(start);
}
