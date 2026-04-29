import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'av-theme';

const readInitialTheme = (): Theme => {
	if (typeof document === 'undefined') return 'dark';
	return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
};

export const ThemeToggle = () => {
	const [theme, setTheme] = useState<Theme>(readInitialTheme);

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
