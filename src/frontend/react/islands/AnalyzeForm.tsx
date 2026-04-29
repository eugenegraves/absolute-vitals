import { useState } from 'react';
import type { TrackResult } from '../../../backend/handlers/analyzeHandlers';

const hostnameOf = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return '';
	}
};

export const AnalyzeForm = () => {
	const [url, setUrl] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (rawUrl: string) => {
		setError(null);
		const value = rawUrl.trim();
		if (!value) {
			setError('enter a url');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch('/api/track-url', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: value })
			});
			const data: TrackResult | { error?: string } = await res.json();
			if (!res.ok || 'error' in data) {
				const message =
					'error' in data && typeof data.error === 'string'
						? data.error
						: `server error (${res.status})`;
				setError(message || 'analyze failed');
				setLoading(false);
				return;
			}
			window.location.href = `/dashboard?projectId=${(data as TrackResult).projectId}`;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setLoading(false);
		}
	};

	const host = hostnameOf(url) || 'URL';

	return (
		<>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void submit(url);
				}}
			>
				<div className="row" style={{ gap: 12 }}>
					<input
						aria-label="URL to analyze"
						className="input input--lg"
						disabled={loading}
						onChange={(event) => setUrl(event.target.value)}
						placeholder="https://example.com"
						type="text"
						value={url}
					/>
					<button
						className="btn btn--lg"
						disabled={loading}
						type="submit"
					>
						Analyze
					</button>
				</div>
				{error !== null && (
					<p
						style={{
							color: 'var(--health-danger)',
							fontSize: 13,
							marginTop: 12
						}}
					>
						{error}
					</p>
				)}
			</form>

			{loading && (
				<div
					aria-live="polite"
					className="analyze-overlay"
					role="status"
				>
					<span className="spinner" />
					<div className="analyze-overlay__title">
						Analyzing {host}…
					</div>
					<p className="analyze-overlay__sub">
						Loading the page in a real browser to measure LCP, FCP, TTFB,
						INP, and CLS. This usually takes 10–20 seconds.
					</p>
				</div>
			)}
		</>
	);
};
