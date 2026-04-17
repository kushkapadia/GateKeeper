"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface BarChartProps {
  data: { value: number; label?: string; color?: string }[];
  height?: number;
  avgLine?: boolean;
  defaultColor?: string;
}

export function BarChart({ data, height = 80, avgLine = true, defaultColor = "hsl(249, 68%, 64%)" }: BarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;
  const barW = Math.max(4, 100 / data.length - 1);
  const gap = 100 / data.length;

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="overflow-visible">
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / max) * (height - 8));
        const x = i * gap + (gap - barW) / 2;
        const y = height - barH;
        const fill = d.color || defaultColor;
        const isHovered = hoveredIdx === i;

        return (
          <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
            <motion.rect
              x={x}
              y={height}
              width={barW}
              rx="1"
              fill={fill}
              opacity={isHovered ? 1 : 0.7}
              initial={{ height: 0, y: height }}
              animate={{ height: barH, y }}
              transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
            />
            {isHovered && (
              <g>
                <rect x={x + barW / 2 - 6} y={y - 12} width="12" height="9" rx="1.5" fill="hsl(var(--foreground))" opacity="0.9" />
                <text x={x + barW / 2} y={y - 5.5} textAnchor="middle" fill="hsl(var(--background))" fontSize="4.5" fontWeight="600">{d.value}</text>
              </g>
            )}
          </g>
        );
      })}

      {avgLine && (
        <line
          x1="0" y1={height - (avg / max) * (height - 8)}
          x2="100" y2={height - (avg / max) * (height - 8)}
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.3" strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
