"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface DataPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showGrid?: boolean;
}

export function AreaChart({ data, height = 140, color = "hsl(249, 68%, 64%)", showDots = true, showGrid = true }: AreaChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (data.length < 2) return null;

  const w = 100; // percent-based
  const padTop = 8;
  const padBot = 20;
  const chartH = height - padTop - padBot;
  const max = Math.max(...data.map((d) => d.value)) || 1;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * w,
    y: padTop + (1 - d.value / max) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + f * chartH);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showGrid && gridLines.map((y, i) => (
        <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.2" />
      ))}

      <path d={areaPath} fill="url(#area-fill)" />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{ strokeWidth: 1.5 }}
      />

      {showDots && points.map((p, i) => (
        <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
          <circle cx={p.x} cy={p.y} r="1.2" fill={color} opacity={hoveredIdx === i ? 1 : 0} className="transition-opacity" />
          <circle cx={p.x} cy={p.y} r="3" fill="transparent" />
          {hoveredIdx === i && (
            <g>
              <rect x={p.x - 8} y={p.y - 14} width="16" height="10" rx="2" fill="hsl(var(--foreground))" opacity="0.9" />
              <text x={p.x} y={p.y - 7} textAnchor="middle" fill="hsl(var(--background))" fontSize="5" fontWeight="600">{data[i].value}</text>
            </g>
          )}
        </g>
      ))}

      {/* X labels — show every few */}
      {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, _, arr) => {
        const idx = data.indexOf(d);
        return (
          <text key={idx} x={points[idx].x} y={height - 4} textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="3.5">{d.label}</text>
        );
      })}
    </svg>
  );
}
