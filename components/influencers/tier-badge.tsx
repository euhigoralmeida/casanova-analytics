import type { InfluencerTier, InfluencerStatus } from "@/lib/influencer-types";

const TIER_STYLES: Record<InfluencerTier, string> = {
  nano: "bg-zinc-100 text-zinc-600",
  micro: "bg-blue-50 text-blue-700",
  mid: "bg-purple-50 text-purple-700",
  macro: "bg-amber-50 text-amber-700",
  mega: "bg-rose-50 text-rose-700",
};

const TIER_LABELS: Record<InfluencerTier, string> = {
  nano: "Nano",
  micro: "Micro",
  mid: "Mid",
  macro: "Macro",
  mega: "Mega",
};

const STATUS_STYLES: Record<InfluencerStatus, string> = {
  ativo: "bg-emerald-50 text-emerald-700",
  em_teste: "bg-amber-50 text-amber-700",
  pausado: "bg-zinc-100 text-zinc-500",
  blacklist: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<InfluencerStatus, string> = {
  ativo: "Ativo",
  em_teste: "Em teste",
  pausado: "Pausado",
  blacklist: "Blacklist",
};

export function TierBadge({ tier }: { tier: InfluencerTier }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none ${TIER_STYLES[tier]}`}>
      {TIER_LABELS[tier]}
    </span>
  );
}

export function StatusBadge({ status }: { status: InfluencerStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
