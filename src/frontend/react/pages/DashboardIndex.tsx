import { Head } from '../components/Head';
import { MetricCard } from '../components/MetricCard';
import { VitalsChart } from '../components/VitalsChart';
import type { DashboardData } from '../../../backend/handlers/dashboardHandlers';

type DashboardIndexProps = {
	data: DashboardData;
	cssPath?: string;
};

const METRIC_META = {
	lcp: {
		label: 'Largest Contentful Paint',
		unit: 'ms' as const,
		threshold: { good: 2500, needsImprovement: 4000 }
	},
	fcp: {
		label: 'First Contentful Paint',
		unit: 'ms' as const,
		threshold: { good: 1800, needsImprovement: 3000 }
	},
	ttfb: {
		label: 'Time to First Byte',
		unit: 'ms' as const,
		threshold: { good: 800, needsImprovement: 1800 }
	},
	inp: {
		label: 'Interaction to Next Paint',
		unit: 'ms' as const,
		threshold: { good: 200, needsImprovement: 500 }
	},
	cls: {
		label: 'Cumulative Layout Shift',
		unit: 'cls' as const,
		threshold: { good: 0.1, needsImprovement: 0.25 }
	}
};

const METRIC_ORDER = ['lcp', 'fcp', 'ttfb', 'inp', 'cls'] as const;

const formatRelative = (ts: number | null) => {
	if (ts === null) return 'no data';
	const seconds = Math.floor((Date.now() - ts) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	return `${Math.floor(seconds / 3600)}h ago`;
};

export const DashboardIndex = ({ data, cssPath }: DashboardIndexProps) => (
	<html lang="en">
		<Head title="AbsoluteVitals · Dashboard" cssPath={cssPath} />
		<body className="bg-slate-100 min-h-screen">
			<header className="bg-white border-b border-slate-200">
				<div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-slate-900">AbsoluteVitals</h1>
						<p className="text-xs text-slate-500">
							Core Web Vitals & uptime · {data.projects.length} project
							{data.projects.length === 1 ? '' : 's'}
						</p>
					</div>
					<nav className="flex items-center gap-4 text-sm">
						<a className="text-slate-700 hover:text-slate-900" href="/dashboard">
							Dashboard
						</a>
						<a className="text-slate-700 hover:text-slate-900" href="/status">
							Status
						</a>
						<a className="text-slate-700 hover:text-slate-900" href="/swagger">
							API
						</a>
					</nav>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
				{data.projects.length === 0 && (
					<div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
						<h2 className="text-lg font-semibold text-slate-900">
							No projects yet
						</h2>
						<p className="mt-2 text-sm text-slate-600">
							Create one with{' '}
							<code className="bg-slate-100 px-2 py-0.5 rounded">
								bun scripts/create-project.ts --name=Demo --origin=https://example.com
							</code>
						</p>
					</div>
				)}

				{data.projects.map((project) => (
					<section
						key={project.id}
						className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
					>
						<header className="flex items-baseline justify-between border-b border-slate-100 pb-4 mb-6">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									{project.name}
								</h2>
								<p className="text-xs text-slate-500">{project.origin}</p>
							</div>
							<div className="text-right">
								<p className="text-xs text-slate-500">Uptime (15 min)</p>
								<p className="text-lg font-semibold text-slate-900">
									{project.uptime.okRate15m === null
										? '—'
										: `${(project.uptime.okRate15m * 100).toFixed(1)}%`}
								</p>
								<p className="text-xs text-slate-400">
									last ping {formatRelative(project.uptime.lastPingAt)}
								</p>
							</div>
						</header>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
							{METRIC_ORDER.map((m) => {
								const meta = METRIC_META[m];
								const summary = project.perMetric[m];
								return (
									<MetricCard
										key={m}
										label={m.toUpperCase()}
										unit={meta.unit}
										p50={summary.p50}
										p75={summary.p75}
										p95={summary.p95}
										count={summary.count}
										threshold={meta.threshold}
									/>
								);
							})}
						</div>

						<div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
							{METRIC_ORDER.map((m) => {
								const meta = METRIC_META[m];
								const summary = project.perMetric[m];
								return (
									<div key={m}>
										<h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
											{meta.label}
										</h4>
										<VitalsChart
											metric={m}
											unit={meta.unit}
											data={summary.recent}
											threshold={meta.threshold}
										/>
									</div>
								);
							})}
						</div>
					</section>
				))}

				<footer className="text-center text-xs text-slate-400 py-4">
					generated {new Date(data.generatedAt).toISOString()}
				</footer>
			</main>
		</body>
	</html>
);
