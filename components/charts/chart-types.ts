import type { TimeSeriesPoint } from "@/types/api";
export type ChartPoint = TimeSeriesPoint & { label: string; cpm: number };
export type ChartTab = "receita" | "roas" | "conversoes" | "trafego" | "cpmclicks" | "trimestre" | "funilga4";
export const chartTabs: { key: ChartTab; label: string }[] = [
  { key: "receita", label: "Receita vs Gasto" },
  { key: "roas", label: "ROAS" },
  { key: "conversoes", label: "Conversões" },
  { key: "trafego", label: "Tráfego" },
  { key: "cpmclicks", label: "CPM vs Cliques" },
  { key: "trimestre", label: "Tri vs Sem" },
  { key: "funilga4", label: "Funil GA4" },
];
