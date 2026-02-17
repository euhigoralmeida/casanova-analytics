"use client";

import { Megaphone } from "lucide-react";

export default function MetaAdsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <Megaphone className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Meta Ads — Em breve</h2>
          <p className="text-sm text-zinc-500 mb-5">
            Estamos trabalhando na integração com Facebook Ads e Instagram Ads.
            Acompanhe campanhas, ROAS e conversões do Meta junto com Google Ads.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Em desenvolvimento
          </div>
        </div>
      </div>
    </div>
  );
}
