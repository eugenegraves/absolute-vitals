import { useMemo, useState } from 'react';
import type {
	AnalyzeResult,
	TrackResult
} from '../../../backend/handlers/analyzeHandlers';

type ProjectOption = { id: string; name: string };

type AnalyzeFormProps = {
	projects: ProjectOption[];
};

type TrackMode = 'new' | 'existing';

const formatBytes = (n: number): string => {
	if (n === 0) return '0 B';
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const ttfbStatus = (
	r: AnalyzeResult
): 'good' | 'warning' | 'danger' | 'neutral' => {
	if (!r.ok || r.statusCode === 0) return 'danger';
	if (r.ttfbMs <= 800) return 'good';
	if (r.ttfbMs <= 1800) return 'warning';
	return 'danger';
};

const STATUS_LABEL = {
	good: 'Healthy',
	warning: 'Slow',
	danger: 'Failing',
	neutral: 'Unknown'
} as const;

const hostnameOf = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return '';
	}
};

const copyText = async (value: string) => {
	try {
		await navigator.clipboard.writeText(value);
		return true;
	} catch {
		return false;
	}
};

export const AnalyzeForm = ({ projects }: AnalyzeFormProps) => {
	const [url, setUrl] = useState('');
	const [submittedUrl, setSubmittedUrl] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<AnalyzeResult | null>(null);

	const [trackMode, setTrackMode] = useState<TrackMode>(
		projects.length > 0 ? 'existing' : 'new'
	);
	const [trackProjectId, setTrackProjectId] = useState(
		projects[0]?.id ?? ''
	);
	const [trackName, setTrackName] = useState('');
	const [tracking, setTracking] = useState(false);
	const [trackError, setTrackError] = useState<string | null>(null);
	const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
	const [keyCopied, setKeyCopied] = useState(false);

	const suggestedName = useMemo(
		() => hostnameOf(submittedUrl || url),
		[submittedUrl, url]
	);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setResult(null);
		setTrackResult(null);
		setTrackError(null);
		setKeyCopied(false);
		const value = url.trim();
		if (!value) {
			setError('enter a url');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: value })
			});
			if (!res.ok) {
				const text = await res.text();
				setError(`server error (${res.status}): ${text.slice(0, 200)}`);
				return;
			}
			const data = (await res.json()) as AnalyzeResult;
			setResult(data);
			setSubmittedUrl(value);
			if (!trackName) setTrackName(hostnameOf(value));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	const onTrack = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!result) return;
		setTrackError(null);
		setTrackResult(null);
		setKeyCopied(false);
		setTracking(true);
		try {
			const body: Record<string, string> = { url: submittedUrl };
			if (trackMode === 'existing') {
				if (!trackProjectId) {
					setTrackError('pick a project');
					return;
				}
				body.projectId = trackProjectId;
			} else {
				const name = (trackName || suggestedName).trim();
				if (name) body.newProjectName = name;
			}
			const res = await fetch('/api/track-url', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (!res.ok || 'error' in data) {
				setTrackError(
					('error' in data && typeof data.error === 'string'
						? data.error
						: `server error (${res.status})`) || 'track failed'
				);
				return;
			}
			setTrackResult(data as TrackResult);
		} catch (err) {
			setTrackError(err instanceof Error ? err.message : String(err));
		} finally {
			setTracking(false);
		}
	};

	const status = result ? ttfbStatus(result) : 'neutral';

	return (
		<div className="stack stack--xl">
			<form onSubmit={onSubmit}>
				<div className="row" style={{ gap: 12 }}>
					<input
						aria-label="URL to analyze"
						className="input input--lg"
						disabled={loading}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com"
						type="text"
						value={url}
					/>
					<button
						className="btn btn--lg"
						disabled={loading}
						type="submit"
					>
						{loading ? <span className="spinner" /> : null}
						{loading ? 'Analyzing…' : 'Analyze'}
					</button>
				</div>
				{error && (
					<p
						className="muted"
						style={{
							color: 'var(--health-danger)',
							marginTop: 12,
							fontSize: 13
						}}
					>
						{error}
					</p>
				)}
			</form>

			{result && (
				<section className="card stack stack--lg">
					<header className="card__header" style={{ marginBottom: 0 }}>
						<div>
							<div
								className="muted"
								style={{ fontSize: 11, letterSpacing: '0.06em' }}
							>
								RESULT
							</div>
							<h2
								className="card__title"
								style={{
									wordBreak: 'break-all',
									marginTop: 4
								}}
							>
								{result.url}
							</h2>
						</div>
						<div className="row" style={{ gap: 8 }}>
							<span
								className={`badge badge--${result.error ? 'danger' : status}`}
							>
								<span
									className={`health-dot health-dot--${result.error ? 'danger' : status}`}
								/>
								{result.error ? 'Failed' : STATUS_LABEL[status]}
							</span>
						</div>
					</header>

					{result.error && (
						<div
							style={{
								color: 'var(--health-danger)',
								fontSize: 13,
								background: 'rgba(248, 113, 113, 0.08)',
								border: '1px solid rgba(248, 113, 113, 0.3)',
								borderRadius: 'var(--radius-sm)',
								padding: 12
							}}
						>
							{result.error}
						</div>
					)}

					<div className="kpi-grid">
						<div className="kpi">
							<div className="kpi__label">TTFB</div>
							<div className="kpi__value">{result.ttfbMs} ms</div>
						</div>
						<div className="kpi">
							<div className="kpi__label">Total time</div>
							<div className="kpi__value">{result.totalMs} ms</div>
						</div>
						<div className="kpi">
							<div className="kpi__label">Status code</div>
							<div className="kpi__value">{result.statusCode || '—'}</div>
						</div>
						<div className="kpi">
							<div className="kpi__label">Body size</div>
							<div className="kpi__value">
								{formatBytes(result.bodyBytes)}
							</div>
						</div>
					</div>

					<div className="stack" style={{ '--stack-gap': '14px' } as React.CSSProperties}>
						<div>
							<div
								className="muted"
								style={{
									fontSize: 11,
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 4
								}}
							>
								Title
							</div>
							<div>{result.title ?? <span className="muted">—</span>}</div>
						</div>
						<div>
							<div
								className="muted"
								style={{
									fontSize: 11,
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 4
								}}
							>
								Description
							</div>
							<div>
								{result.description ?? <span className="muted">—</span>}
							</div>
						</div>
						<div className="row" style={{ flexWrap: 'wrap', gap: 24 }}>
							<div>
								<div
									className="muted"
									style={{
										fontSize: 11,
										letterSpacing: '0.06em',
										textTransform: 'uppercase'
									}}
								>
									Content-Type
								</div>
								<div className="code" style={{ marginTop: 4 }}>
									{result.contentType ?? '—'}
								</div>
							</div>
							<div>
								<div
									className="muted"
									style={{
										fontSize: 11,
										letterSpacing: '0.06em',
										textTransform: 'uppercase'
									}}
								>
									Content-Encoding
								</div>
								<div className="code" style={{ marginTop: 4 }}>
									{result.contentEncoding ?? 'identity'}
								</div>
							</div>
						</div>
					</div>

					{!trackResult && (
						<details>
							<summary
								style={{
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: 14,
									padding: '8px 0',
									color: 'var(--text-primary)'
								}}
							>
								Track this URL →
							</summary>
							<form
								onSubmit={onTrack}
								style={{ marginTop: 12 }}
								className="stack stack--lg"
							>
								<div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
									<label
										className="row"
										style={{
											gap: 8,
											cursor:
												projects.length === 0 ? 'not-allowed' : 'pointer',
											opacity: projects.length === 0 ? 0.5 : 1
										}}
									>
										<input
											checked={trackMode === 'existing'}
											disabled={projects.length === 0}
											name="trackMode"
											onChange={() => setTrackMode('existing')}
											type="radio"
										/>
										<span>Add to existing project</span>
									</label>
									<label className="row" style={{ gap: 8, cursor: 'pointer' }}>
										<input
											checked={trackMode === 'new'}
											name="trackMode"
											onChange={() => setTrackMode('new')}
											type="radio"
										/>
										<span>Create new project</span>
									</label>
								</div>

								{trackMode === 'existing' && (
									<div>
										<label className="label" htmlFor="trackProject">
											Project
										</label>
										<select
											className="input"
											id="trackProject"
											onChange={(e) => setTrackProjectId(e.target.value)}
											value={trackProjectId}
										>
											{projects.map((p) => (
												<option key={p.id} value={p.id}>
													{p.name}
												</option>
											))}
										</select>
									</div>
								)}

								{trackMode === 'new' && (
									<div>
										<label className="label" htmlFor="trackName">
											Project name
										</label>
										<input
											className="input"
											id="trackName"
											onChange={(e) => setTrackName(e.target.value)}
											placeholder={suggestedName || 'My project'}
											type="text"
											value={trackName}
										/>
									</div>
								)}

								<div className="row">
									<button
										className="btn"
										disabled={tracking}
										type="submit"
									>
										{tracking ? <span className="spinner" /> : null}
										{tracking ? 'Tracking…' : 'Track URL'}
									</button>
									{trackError && (
										<span
											style={{
												color: 'var(--health-danger)',
												fontSize: 13
											}}
										>
											{trackError}
										</span>
									)}
								</div>
							</form>
						</details>
					)}

					{trackResult && (
						<div
							className="stack"
							style={{
								background: 'var(--bg-elevated)',
								border: '1px solid var(--border)',
								borderRadius: 'var(--radius-sm)',
								padding: 16
							}}
						>
							<div className="row" style={{ gap: 8 }}>
								<span className="badge badge--good">
									<span className="health-dot health-dot--good" />
									{trackResult.created ? 'Project created' : 'Tracked'}
								</span>
								<span style={{ fontWeight: 600 }}>
									{trackResult.projectName}
								</span>
							</div>
							<div>
								<div
									className="muted"
									style={{
										fontSize: 11,
										textTransform: 'uppercase',
										letterSpacing: '0.06em'
									}}
								>
									Project ID
								</div>
								<div className="code" style={{ marginTop: 4 }}>
									{trackResult.projectId}
								</div>
							</div>
							<div>
								<div
									className="muted"
									style={{
										fontSize: 11,
										textTransform: 'uppercase',
										letterSpacing: '0.06em'
									}}
								>
									API Key
								</div>
								<div className="row" style={{ marginTop: 4, gap: 8 }}>
									<code
										className="code"
										style={{
											flex: 1,
											wordBreak: 'break-all'
										}}
									>
										{trackResult.apiKey}
									</code>
									<button
										className="btn btn--ghost"
										onClick={async () => {
											const ok = await copyText(trackResult.apiKey);
											if (ok) setKeyCopied(true);
										}}
										type="button"
									>
										{keyCopied ? '✓ Copied' : 'Copy'}
									</button>
								</div>
								{trackResult.created && (
									<p
										style={{
											color: 'var(--health-warning)',
											fontSize: 12,
											marginTop: 8
										}}
									>
										Save this — it won't be shown again.
									</p>
								)}
							</div>
							<a
								className="btn btn--secondary"
								href="/dashboard"
								style={{ alignSelf: 'flex-start' }}
							>
								View on dashboard →
							</a>
						</div>
					)}
				</section>
			)}
		</div>
	);
};
