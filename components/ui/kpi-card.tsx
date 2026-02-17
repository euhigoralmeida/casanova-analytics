import type { KpiStatus } from "@/types/api";

export default function Kpi(props: { title: string; value: string; subtitle?: string; status?: KpiStatus; color?: string }) {
  const borderClass =
    props.status === "ok" ? "border-emerald-300" :
    props.status === "warn" ? "border-amber-300" :
    props.status === "danger" ? "border-red-300" :
    "";
  return (
    <div className={`rounded-xl border bg-white p-4 ${borderClass}`}>
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{props.title}</p>
      <p className={`text-2xl font-bold mt-1 ${props.color ?? "text-zinc-900"}`}>{props.value}</p>
      {props.subtitle && <p className="text-[11px] text-zinc-400 mt-0.5">{props.subtitle}</p>}
    </div>
  );
}
