"use client";
import { motion } from "framer-motion";

interface Props {
  value: number; // 0..100
  letter?: string;
  size?: number;
  stroke?: number;
}

export function ProgressRing({ value, letter, size = 56, stroke = 5 }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const color = pct >= 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : pct > 0 ? "#6366f1" : "#94a3b8";
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      {letter ? (
        <span className="absolute font-bold text-lg">{letter}</span>
      ) : (
        <span className="absolute text-xs font-bold">{Math.round(pct)}%</span>
      )}
    </div>
  );
}
