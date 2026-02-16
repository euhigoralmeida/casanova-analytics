import type { KpiStatus } from "@/types/api";

export default function Kpi(props: { title: string; value: string; subtitle: string; status?: KpiStatus }) {
  const borderClass =
    props.status === "ok" ? "border-emerald-300" :
    props.status === "warn" ? "border-amber-300" :
    props.status === "danger" ? "border-red-300" :
    "";
  return (
    <div className={`rounded-xl border bg-white p-4 ${borderClass}`}>
      <p className="text-sm text-zinc-600">{props.title}</p>
      <p className="mt-2 text-2xl font-semibold">{props.value}</p>
      <p className="mt-1 text-xs text-zinc-500">{props.subtitle}</p>
    </div>
  );
}
