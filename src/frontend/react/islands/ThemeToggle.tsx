import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'av-theme';

export const ThemeToggle = () => {
	const [theme, setTheme] = useState<Theme>('dark');

	useEffect(() => {
		const stored = (() => {
			try {
				const value = localStorage.getItem(STORAGE_KEY);
				return value === 'light' || value === 'dark' ? value : null;
			} catch {
				return null;
			}
		})();
		const fromDom =
			document.documentElement.dataset.theme === 'light' ? 'light' : null;
		const actual: Theme = stored ?? fromDom ?? 'dark';
		if (actual !== 'dark') setTheme(actual);
	}, []);

	useEffect(() => {
		if (theme === 'light') {
			document.documentElement.dataset.theme = 'light';
		} else {
			delete document.documentElement.dataset.theme;
		}
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			/* localStorage may be unavailable */
		}
	}, [theme]);

	const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
	const next = theme === 'light' ? 'dark' : 'light';
	const icon = theme === 'light' ? '🌙' : '☀️';
	const label = theme === 'light' ? 'Dark' : 'Light';

	return (
		<button
			aria-label={`Switch to ${next} mode`}
			className="theme-toggle"
			onClick={toggle}
			type="button"
		>
			<span aria-hidden="true" className="theme-toggle__icon">
				{icon}
			</span>
			<span>{label}</span>
		</button>
	);
};
