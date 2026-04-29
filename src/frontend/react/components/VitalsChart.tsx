export type VitalsChartPoint = { t: number; value: number };

export type VitalsChartProps = {
	metric: 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls' | 'uptime';
	unit: 'ms' | 'cls' | 'pct';
	data: VitalsChartPoint[];
	threshold?: { good: number; needsImprovement: number };
};

const barColor = (
	value: number,
	threshold?: VitalsChartProps['threshold']
) => {
	if (!threshold) return 'bg-sky-500';
	if (value <= threshold.good) return 'bg-emerald-500';
	if (value <= threshold.needsImprovement) return 'bg-amber-500';
	return 'bg-red-500';
};

export const VitalsChart = ({ data, threshold }: VitalsChartProps) => {
	if (data.length === 0) {
		return (
			<div className="h-32 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded">
				no samples in window
			</div>
		);
	}
	const max = Math.max(...data.map((p) => p.value), 1);
	return (
		<div className="h-32 flex items-end gap-0.5 bg-slate-50 rounded p-2">
			{data.map((p, i) => (
				<div
					key={`${p.t}-${i}`}
					className={`flex-1 min-w-[2px] rounded-sm ${barColor(p.value, threshold)}`}
					style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
					title={`${new Date(p.t).toLocaleTimeString()} — ${p.value}`}
				/>
			))}
		</div>
	);
};
