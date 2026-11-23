import * as React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  status?: 'up' | 'down' | 'degraded' | 'unknown';
}

export function Sparkline({
  data = [],
  width = 120,
  height = 32,
  status = 'up',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-slate-600 font-mono"
      >
        gathering...
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Color mapping based on status
  let strokeColor = '#10b981'; // emerald-500
  let fillColor = 'rgba(16, 185, 129, 0.15)';

  if (status === 'down') {
    strokeColor = '#f43f5e'; // rose-500
    fillColor = 'rgba(244, 63, 94, 0.15)';
  } else if (status === 'degraded') {
    strokeColor = '#f59e0b'; // amber-500
    fillColor = 'rgba(245, 158, 11, 0.15)';
  }

  // Calculate coordinates
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((val, index) => {
    const x = padding + (index / (data.length - 1)) * usableWidth;
    const y =
      padding +
      usableHeight -
      ((val - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`,
    ''
  );

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path d={areaD} fill={fillColor} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest point indicator */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.5"
        fill={strokeColor}
      />
    </svg>
  );
}
