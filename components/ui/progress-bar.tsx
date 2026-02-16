export default function ProgressBar(props: {
  label: string;
  actual: number;
  target: number;
  format: (v: number) => string;
  sublabel?: string;
}) {
  const pct = props.target > 0 ? Math.min((props.actual / props.target) * 100, 120) : 0;
  const clampedPct = Math.min(pct, 100);
  const color =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 70 ? "bg-blue-500" :
    pct >= 40 ? "bg-amber-400" :
    "bg-red-400";
  const textColor =
    pct >= 100 ? "text-emerald-600" :
    pct >= 70 ? "text-blue-600" :
    pct >= 40 ? "text-amber-600" :
    "text-red-600";

  return (
    <div className="group">
      <div className="flex items-baseline justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium text-zinc-700">{props.label}</span>
          {props.sublabel && <span className="text-xs text-zinc-400 ml-1.5">{props.sublabel}</span>}
        </div>
        <div className="text-right">
          <span className={`text-sm font-semibold ${textColor}`}>
            {props.format(props.actual)}
          </span>
          <span className="text-xs text-zinc-400 ml-1">
            / {props.format(props.target)}
          </span>
        </div>
      </div>
      <div className="relative h-2.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <div className="flex justify-end mt-0.5">
        <span className={`text-[11px] font-medium ${textColor}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
