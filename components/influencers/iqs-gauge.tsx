"use client";

import { iqsLabel } from "@/lib/influencer-types";

interface IQSGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { width: 56, stroke: 5, fontSize: 14, labelSize: 8 },
  md: { width: 100, stroke: 7, fontSize: 24, labelSize: 11 },
  lg: { width: 160, stroke: 10, fontSize: 38, labelSize: 14 },
};

function gaugeColor(score: number): string {
  if (score >= 80) return "#10b981"; // emerald-500
  if (score >= 60) return "#22c55e"; // green-500
  if (score >= 40) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export default function IQSGauge({ score, size = "md", showLabel = true }: IQSGaugeProps) {
  const { width, stroke, fontSize, labelSize } = SIZE_MAP[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - pct);
  const color = gaugeColor(score);
  const center = width / 2;

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={width} height={width} viewBox={`0 0 ${width} ${width}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={stroke}
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
        />
        {/* Score text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={fontSize}
          fontWeight="700"
        >
          {score}
        </text>
      </svg>
      {showLabel && (
        <span
          className="font-medium mt-0.5"
          style={{ fontSize: labelSize, color }}
        >
          {iqsLabel(score)}
        </span>
      )}
    </div>
  );
}
