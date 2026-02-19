"use client";

import { Music } from "lucide-react";

export default function TikTokAdsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-cyan-500 via-pink-500 to-red-500 flex items-center justify-center">
            <Music className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">TikTok Ads — Em breve</h2>
          <p className="text-sm text-zinc-500 mb-5">
            Estamos trabalhando na integração com TikTok Ads.
            Acompanhe campanhas, ROAS e conversões do TikTok junto com Google Ads e Meta Ads.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-50 text-pink-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
            Em desenvolvimento
          </div>
        </div>
      </div>
    </div>
  );
}
