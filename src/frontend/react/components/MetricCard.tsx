type Status = 'good' | 'warning' | 'danger' | 'neutral';

type MetricCardProps = {
	label: string;
	description: string;
	unit: 'ms' | 'cls' | 'pct';
	p50: number | null;
	p75: number | null;
	p95: number | null;
	count: number;
	threshold?: { good: number; needsImprovement: number };
};

const formatValue = (v: number | null, unit: MetricCardProps['unit']) => {
	if (v === null) return '—';
	if (unit === 'cls') return v.toFixed(3);
	if (unit === 'pct') return `${(v * 100).toFixed(1)}%`;
	return `${Math.round(v)} ms`;
};

const statusFor = (
	v: number | null,
	threshold?: MetricCardProps['threshold']
): Status => {
	if (v === null || !threshold) return 'neutral';
	if (v <= threshold.good) return 'good';
	if (v <= threshold.needsImprovement) return 'warning';
	return 'danger';
};

const STATUS_LABEL: Record<Status, string> = {
	good: 'Good',
	warning: 'Needs Improvement',
	danger: 'Poor',
	neutral: 'No Data'
};

const markerPercent = (
	v: number | null,
	threshold?: MetricCardProps['threshold']
) => {
	if (v === null || !threshold) return null;
	const max = threshold.needsImprovement * 1.4;
	const pct = (v / max) * 100;
	return Math.max(2, Math.min(98, pct));
};

const formatThreshold = (v: number, unit: MetricCardProps['unit']) => {
	if (unit === 'cls') return v.toFixed(2);
	if (unit === 'pct') return `${Math.round(v * 100)}%`;
	if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
	return `${v}ms`;
};

export const MetricCard = ({
	label,
	description,
	unit,
	p50,
	p75,
	p95,
	count,
	threshold
}: MetricCardProps) => {
	const status = statusFor(p75, threshold);
	const marker = markerPercent(p75, threshold);

	return (
		<div className="metric-card">
			<div className="metric-card__header">
				<h3 className="metric-card__label">{label}</h3>
				<span
					className="info-wrapper"
					tabIndex={0}
				>
					<span aria-label={`About ${label}`} className="info-trigger">
						i
					</span>
					<span className="info-popover">
						<strong>{label}</strong>
						<br />
						{description}
						{threshold && (
							<>
								<br />
								<br />
								Good ≤ <strong>{formatThreshold(threshold.good, unit)}</strong>{' '}
								· needs improvement ≤{' '}
								<strong>
									{formatThreshold(threshold.needsImprovement, unit)}
								</strong>
							</>
						)}
					</span>
				</span>
			</div>

			<div className="metric-card__health">
				<span className={`health-dot health-dot--${status}`} />
				<span className={`metric-card__status metric-card__status--${status}`}>
					{STATUS_LABEL[status]}
				</span>
			</div>

			<div className="metric-card__value">{formatValue(p75, unit)}</div>

			{threshold && (
				<div
					aria-label="threshold gauge"
					className="gauge"
					role="img"
				>
					<div className="gauge__seg gauge__seg--good" style={{ flex: 2 }} />
					<div
						className="gauge__seg gauge__seg--warning"
						style={{ flex: 1.5 }}
					/>
					<div
						className="gauge__seg gauge__seg--danger"
						style={{ flex: 1 }}
					/>
					{marker !== null && (
						<div
							className="gauge__marker"
							style={{ left: `${marker}%` }}
						/>
					)}
				</div>
			)}

			<div className="metric-card__sub">
				<span>
					p50 <strong>{formatValue(p50, unit)}</strong>
				</span>
				<span>
					p95 <strong>{formatValue(p95, unit)}</strong>
				</span>
				<span style={{ marginLeft: 'auto' }}>{count} samples</span>
			</div>
		</div>
	);
};
