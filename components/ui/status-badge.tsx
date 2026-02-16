export default function StatusBadge(props: { status: "escalar" | "manter" | "pausar" }) {
  const cfg = {
    escalar: { bg: "bg-emerald-100 text-emerald-800", label: "Escalar" },
    manter: { bg: "bg-amber-100 text-amber-800", label: "Manter" },
    pausar: { bg: "bg-red-100 text-red-800", label: "Pausar" },
  } as const;
  const { bg, label } = cfg[props.status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}
