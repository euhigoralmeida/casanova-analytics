import type { KpiStatus } from "@/types/api";

interface KpiProgress {
  actual: number;
  target: number;
  format: (v: number) => string;
}

export default function Kpi(props: {
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  status?: KpiStatus;
  color?: string;
  progress?: KpiProgress;
}) {
  const borderClass =
    props.status === "ok" ? "border-emerald-300" :
    props.status === "warn" ? "border-amber-300" :
    props.status === "danger" ? "border-red-300" :
    "";

  const prog = props.progress;
  const pct = prog && prog.target > 0 ? Math.min((prog.actual / prog.target) * 100, 120) : 0;
  const clampedPct = Math.min(pct, 100);

  // Gradient: red → amber → emerald as it approaches target
  const barColor =
    pct >= 90 ? "bg-emerald-500" :
    pct >= 70 ? "bg-emerald-400" :
    pct >= 50 ? "bg-amber-400" :
    pct >= 30 ? "bg-orange-400" :
    "bg-red-400";
  const pctColor =
    pct >= 90 ? "text-emerald-600" :
    pct >= 70 ? "text-emerald-500" :
    pct >= 50 ? "text-amber-600" :
    pct >= 30 ? "text-orange-600" :
    "text-red-600";

  return (
    <div className={`rounded-xl border bg-white p-4 ${borderClass}`}>
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{props.title}</p>
      <p className="text-2xl font-bold mt-1 text-zinc-900">{props.value}</p>
      {props.subtitle && <p className="text-[11px] text-zinc-400 mt-0.5">{props.subtitle}</p>}
      {prog && prog.target > 0 && (
        <div className="mt-2">
          <div className="h-[6px] rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
              style={{ width: `${clampedPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-zinc-400">
              {prog.format(prog.actual)} / {prog.format(prog.target)}
            </span>
            <span className={`text-[10px] font-semibold ${pctColor}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
