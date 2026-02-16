export default function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "ENABLED") {
    return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Ativa" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" title="Pausada" />;
}
