import { useMemo, useRef, useState } from 'react';

export type VitalsChartPoint = { t: number; value: number };

export type VitalsChartProps = {
	metric: 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls' | 'uptime';
	unit: 'ms' | 'cls' | 'pct';
	data: VitalsChartPoint[];
	threshold?: { good: number; needsImprovement: number };
};

const VIEW_W = 800;
const VIEW_H = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;

const formatValue = (v: number, unit: VitalsChartProps['unit']) => {
	if (unit === 'cls') return v.toFixed(3);
	if (unit === 'pct') return `${(v * 100).toFixed(1)}%`;
	return `${Math.round(v)} ms`;
};

const colorForValue = (
	value: number,
	threshold?: VitalsChartProps['threshold']
) => {
	if (!threshold) return 'var(--accent)';
	if (value <= threshold.good) return 'var(--health-good)';
	if (value <= threshold.needsImprovement) return 'var(--health-warning)';
	return 'var(--health-danger)';
};

export const VitalsChart = ({
	metric,
	unit,
	data,
	threshold
}: VitalsChartProps) => {
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const [hover, setHover] = useState<{
		point: VitalsChartPoint;
		x: number;
		y: number;
	} | null>(null);

	const layout = useMemo(() => {
		if (data.length === 0) return null;
		const values = data.map((p) => p.value);
		const rawMax = Math.max(...values, 1);
		const yMax = threshold
			? Math.max(threshold.needsImprovement * 1.2, rawMax * 1.05)
			: rawMax * 1.05;
		const yMin = 0;
		const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
		const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
		const xFor = (i: number) => {
			if (data.length === 1) return PAD_LEFT + innerW / 2;
			return PAD_LEFT + (i / (data.length - 1)) * innerW;
		};
		const yFor = (v: number) =>
			PAD_TOP + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

		const points = data.map((p, i) => ({
			...p,
			cx: xFor(i),
			cy: yFor(p.value)
		}));
		const polyline = points.map((p) => `${p.cx},${p.cy}`).join(' ');
		const goodY = threshold ? yFor(threshold.good) : null;
		const warnY = threshold ? yFor(threshold.needsImprovement) : null;
		return { points, polyline, goodY, warnY, yMax };
	}, [data, threshold]);

	if (!layout) {
		return (
			<div className="chart-empty">no samples in window</div>
		);
	}

	const handleEnter = (
		event: React.MouseEvent<SVGCircleElement>,
		point: VitalsChartPoint
	) => {
		const wrapper = wrapperRef.current;
		if (!wrapper) {
			setHover({ point, x: 0, y: 0 });
			return;
		}
		const wrapperRect = wrapper.getBoundingClientRect();
		const targetRect = (
			event.currentTarget as SVGCircleElement
		).getBoundingClientRect();
		setHover({
			point,
			x: targetRect.left + targetRect.width / 2 - wrapperRect.left,
			y: targetRect.top - wrapperRect.top
		});
	};

	const handleLeave = () => setHover(null);

	return (
		<div
			ref={wrapperRef}
			style={{ position: 'relative', width: '100%' }}
		>
			<svg
				aria-label={`${metric} timeseries`}
				className="chart-svg"
				preserveAspectRatio="none"
				role="img"
				viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
			>
				{layout.goodY !== null && (
					<line
						stroke="var(--health-good)"
						strokeDasharray="4 4"
						strokeOpacity="0.55"
						strokeWidth="1"
						x1={PAD_LEFT}
						x2={VIEW_W - PAD_RIGHT}
						y1={layout.goodY}
						y2={layout.goodY}
					/>
				)}
				{layout.warnY !== null && (
					<line
						stroke="var(--health-warning)"
						strokeDasharray="4 4"
						strokeOpacity="0.55"
						strokeWidth="1"
						x1={PAD_LEFT}
						x2={VIEW_W - PAD_RIGHT}
						y1={layout.warnY}
						y2={layout.warnY}
					/>
				)}

				<polyline
					fill="none"
					points={layout.polyline}
					stroke="var(--accent)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
					vectorEffect="non-scaling-stroke"
				/>

				{layout.points.map((p, i) => (
					<circle
						key={`${p.t}-${i}`}
						cx={p.cx}
						cy={p.cy}
						fill={colorForValue(p.value, threshold)}
						onMouseEnter={(e) => handleEnter(e, p)}
						onMouseLeave={handleLeave}
						r={hover?.point === p ? 5 : 3.5}
						stroke="var(--bg-card)"
						strokeWidth="1.5"
						style={{ cursor: 'pointer', transition: 'r 80ms linear' }}
					/>
				))}
			</svg>
			{hover && (
				<div
					className="chart-tooltip"
					style={{ left: hover.x, top: hover.y }}
				>
					<div>
						<strong>{formatValue(hover.point.value, unit)}</strong>
					</div>
					<div className="chart-tooltip__time">
						{new Date(hover.point.t).toLocaleString()}
					</div>
				</div>
			)}
		</div>
	);
};
