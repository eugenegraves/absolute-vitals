type MetricCardProps = {
	label: string;
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

const pillColor = (
	v: number | null,
	threshold?: MetricCardProps['threshold']
) => {
	if (v === null || !threshold) return 'bg-slate-200 text-slate-700';
	if (v <= threshold.good) return 'bg-emerald-100 text-emerald-800';
	if (v <= threshold.needsImprovement) return 'bg-amber-100 text-amber-800';
	return 'bg-red-100 text-red-800';
};

export const MetricCard = ({
	label,
	unit,
	p50,
	p75,
	p95,
	count,
	threshold
}: MetricCardProps) => (
	<div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
		<div className="flex items-baseline justify-between">
			<h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
				{label}
			</h3>
			<span className="text-xs text-slate-400">{count} samples</span>
		</div>
		<div className="mt-3 flex items-baseline gap-2">
			<span className="text-3xl font-bold text-slate-900">
				{formatValue(p75, unit)}
			</span>
			<span
				className={`text-xs font-medium px-2 py-0.5 rounded ${pillColor(p75, threshold)}`}
			>
				p75
			</span>
		</div>
		<div className="mt-3 flex gap-4 text-xs text-slate-500">
			<span>
				p50 <span className="font-medium text-slate-700">{formatValue(p50, unit)}</span>
			</span>
			<span>
				p95 <span className="font-medium text-slate-700">{formatValue(p95, unit)}</span>
			</span>
		</div>
	</div>
);
