import { channelColors, channelLabels } from "@/lib/constants";

export default function ChannelBadge({ type }: { type: string }) {
  const bg = channelColors[type] ?? "bg-zinc-100 text-zinc-800";
  const label = channelLabels[type] ?? type;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}
