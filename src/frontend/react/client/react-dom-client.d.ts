declare module 'react-dom/client' {
	import type { ReactNode } from 'react';

	type Root = {
		render(children: ReactNode): void;
		unmount(): void;
	};

	type RootOptions = {
		onRecoverableError?: (error: unknown) => void;
	};

	export function hydrateRoot(
		container: Element | Document | DocumentFragment,
		children: ReactNode,
		options?: RootOptions
	): Root;

	export function createRoot(
		container: Element | Document | DocumentFragment,
		options?: RootOptions
	): Root;
}
