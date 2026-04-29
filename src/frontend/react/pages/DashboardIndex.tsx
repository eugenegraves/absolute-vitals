import { Island } from '@absolutejs/absolute/react';
import { Head } from '../components/Head';
import { MetricCard } from '../components/MetricCard';
import type {
	DashboardData,
	ProjectDashboard
} from '../../../backend/handlers/dashboardHandlers';

type DashboardIndexProps = {
	data: DashboardData;
	cssPath?: string;
};

const METRIC_META = {
	lcp: {
		label: 'LCP',
		full: 'Largest Contentful Paint',
		description:
			'Largest Contentful Paint measures perceived loading performance — when the largest image or text block in the viewport finishes rendering.',
		unit: 'ms' as const,
		threshold: { good: 2500, needsImprovement: 4000 }
	},
	fcp: {
		label: 'FCP',
		full: 'First Contentful Paint',
		description:
			'First Contentful Paint measures when the first text or image is painted — when the browser stops showing a blank screen.',
		unit: 'ms' as const,
		threshold: { good: 1800, needsImprovement: 3000 }
	},
	ttfb: {
		label: 'TTFB',
		full: 'Time to First Byte',
		description:
			'Time to First Byte measures how long the server takes to send the first byte of the response — backend + network latency.',
		unit: 'ms' as const,
		threshold: { good: 800, needsImprovement: 1800 }
	},
	inp: {
		label: 'INP',
		full: 'Interaction to Next Paint',
		description:
			'Interaction to Next Paint measures responsiveness — the latency between a user interaction and the next visual update.',
		unit: 'ms' as const,
		threshold: { good: 200, needsImprovement: 500 }
	},
	cls: {
		label: 'CLS',
		full: 'Cumulative Layout Shift',
		description:
			'Cumulative Layout Shift measures visual stability — the sum of unexpected layout shifts during the page lifetime.',
		unit: 'cls' as const,
		threshold: { good: 0.1, needsImprovement: 0.25 }
	}
};

const METRIC_ORDER = ['lcp', 'fcp', 'ttfb', 'inp', 'cls'] as const;

type Status = 'good' | 'warning' | 'danger' | 'neutral';

const formatRelative = (ts: number | null) => {
	if (ts === null) return 'no data';
	const seconds = Math.floor((Date.now() - ts) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	return `${Math.floor(seconds / 3600)}h ago`;
};

const worstStatus = (a: Status, b: Status): Status => {
	const order: Record<Status, number> = {
		good: 0,
		neutral: 1,
		warning: 2,
		danger: 3
	};
	return order[a] >= order[b] ? a : b;
};

const projectStatus = (project: ProjectDashboard): Status => {
	let s: Status = 'neutral';
	for (const m of METRIC_ORDER) {
		const summary = project.perMetric[m];
		const meta = METRIC_META[m];
		if (summary.p75 === null) continue;
		if (summary.p75 <= meta.threshold.good) s = worstStatus(s, 'good');
		else if (summary.p75 <= meta.threshold.needsImprovement)
			s = worstStatus(s, 'warning');
		else s = worstStatus(s, 'danger');
	}
	const okRate = project.uptime.okRate15m;
	if (okRate !== null) {
		if (okRate >= 0.95) s = worstStatus(s, 'good');
		else if (okRate >= 0.5) s = worstStatus(s, 'warning');
		else s = worstStatus(s, 'danger');
	}
	return s;
};

const globalStatus = (data: DashboardData): Status => {
	let s: Status = 'neutral';
	for (const p of data.projects) s = worstStatus(s, projectStatus(p));
	return s;
};

const STATUS_COPY: Record<Status, { title: string; sub: string }> = {
	good: {
		title: 'All systems operational',
		sub: 'All projects within Web Vitals thresholds.'
	},
	warning: {
		title: 'Performance degraded',
		sub: 'One or more projects need improvement.'
	},
	danger: {
		title: 'Performance issues detected',
		sub: 'Critical thresholds exceeded — investigate poor-performing projects.'
	},
	neutral: {
		title: 'Awaiting data',
		sub: 'No samples in the last 24 hours.'
	}
};

const formatUptime = (rate: number | null) =>
	rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;

export const DashboardIndex = ({ data, cssPath }: DashboardIndexProps) => {
	const status = globalStatus(data);
	const copy = STATUS_COPY[status];

	return (
		<html lang="en">
			<Head cssPath={cssPath} title="AbsoluteVitals · Dashboard" />
			<body>
				<header className="app-header">
					<div className="container app-header__inner">
						<div>
							<h1 className="app-title">AbsoluteVitals</h1>
							<p className="app-subtitle">
								Core Web Vitals & uptime · {data.projects.length} project
								{data.projects.length === 1 ? '' : 's'}
							</p>
						</div>
						<nav className="app-nav">
							<a className="is-active" href="/dashboard">
								Dashboard
							</a>
							<a href="/analyze">Analyze</a>
							<a href="/status">Status</a>
							<a href="/swagger">API</a>
							<Island
								component="ThemeToggle"
								framework="react"
								props={{}}
							/>
						</nav>
					</div>
				</header>

				<main className="main">
					<div className="container stack stack--xl">
						<section
							className={`health-banner health-banner--${status}`}
						>
							<span
								className={`health-dot health-dot--lg health-dot--${status}`}
							/>
							<div>
								<div className="health-banner__title">{copy.title}</div>
								<div className="health-banner__sub">
									{copy.sub} · {data.totalEvents24h.toLocaleString()} event
									{data.totalEvents24h === 1 ? '' : 's'} in last 24h
								</div>
							</div>
						</section>

						{data.projects.length === 0 && (
							<div className="card">
								<h2 className="card__title">No projects yet</h2>
								<p
									className="muted"
									style={{ marginTop: 8, marginBottom: 16 }}
								>
									Create one with the CLI, or use the URL Analyzer to track
									your first site.
								</p>
								<code className="kbd-block">
									bun scripts/create-project.ts --name=Demo
									--origin=https://example.com
								</code>
							</div>
						)}

						{data.projects.map((project) => {
							const ps = projectStatus(project);
							return (
								<section className="card" key={project.id}>
									<header className="card__header">
										<div className="row" style={{ gap: 12 }}>
											<span
												className={`health-dot health-dot--lg health-dot--${ps}`}
											/>
											<div>
												<h2 className="card__title">{project.name}</h2>
												<p className="card__subtitle">{project.origin}</p>
											</div>
										</div>
										<div style={{ textAlign: 'right' }}>
											<div className="muted" style={{ fontSize: 11 }}>
												UPTIME · 15 MIN
											</div>
											<div
												style={{
													fontSize: 22,
													fontWeight: 700,
													fontVariantNumeric: 'tabular-nums'
												}}
											>
												{formatUptime(project.uptime.okRate15m)}
											</div>
											<div
												className="muted"
												style={{ fontSize: 11 }}
											>
												last ping {formatRelative(project.uptime.lastPingAt)}
											</div>
										</div>
									</header>

									<div className="grid grid--metrics">
										{METRIC_ORDER.map((m) => {
											const meta = METRIC_META[m];
											const summary = project.perMetric[m];
											return (
												<MetricCard
													count={summary.count}
													description={meta.description}
													key={m}
													label={meta.label}
													p50={summary.p50}
													p75={summary.p75}
													p95={summary.p95}
													threshold={meta.threshold}
													unit={meta.unit}
												/>
											);
										})}
									</div>

									<div className="grid grid--charts">
										{METRIC_ORDER.map((m) => {
											const meta = METRIC_META[m];
											const summary = project.perMetric[m];
											return (
												<div className="chart-card" key={m}>
													<div className="chart-card__title">
														{meta.full}
													</div>
													<Island
														component="VitalsChart"
														framework="react"
														props={{
															data: summary.recent,
															metric: m,
															threshold: meta.threshold,
															unit: meta.unit
														}}
													/>
												</div>
											);
										})}
									</div>
								</section>
							);
						})}

						<footer
							className="muted"
							style={{ textAlign: 'center', fontSize: 12, paddingTop: 8 }}
						>
							generated {new Date(data.generatedAt).toISOString()}
						</footer>
					</div>
				</main>
			</body>
		</html>
	);
};
