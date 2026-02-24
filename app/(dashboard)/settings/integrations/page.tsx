"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

type IntegrationStatus = {
  platform: string;
  label: string;
  description: string;
  connected: boolean;
  lastSync?: string;
  envVars: string[];
};

const PLATFORMS: IntegrationStatus[] = [
  {
    platform: "google_ads",
    label: "Google Ads",
    description: "Campanhas Shopping, SKUs, ROAS, CPA, conversões",
    connected: false,
    envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"],
  },
  {
    platform: "ga4",
    label: "Google Analytics 4",
    description: "Funil de conversão, sessões, aquisição por canal, retenção",
    connected: false,
    envVars: ["GA4_PROPERTY_ID", "GA4_CLIENT_EMAIL", "GA4_PRIVATE_KEY_BASE64"],
  },
  {
    platform: "meta_ads",
    label: "Meta Ads",
    description: "Campanhas Facebook/Instagram Ads, métricas de performance",
    connected: false,
    envVars: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"],
  },
  {
    platform: "google_search_console",
    label: "Google Search Console",
    description: "SEO orgânico, queries, páginas, impressões, cliques",
    connected: false,
    envVars: ["GSC_SITE_URL", "GSC_CLIENT_EMAIL"],
  },
  {
    platform: "clarity",
    label: "Microsoft Clarity",
    description: "CRO, dead/rage clicks, scroll depth, heatmaps",
    connected: false,
    envVars: ["CLARITY_PROJECT_ID", "CLARITY_API_TOKEN"],
  },
  {
    platform: "instagram",
    label: "Instagram Business",
    description: "Insights do perfil, publicações, audiência, crescimento",
    connected: false,
    envVars: ["META_ADS_ACCESS_TOKEN"],
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(PLATFORMS);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations((prev) =>
          prev.map((p) => {
            const status = data.integrations?.find((i: { platform: string }) => i.platform === p.platform);
            return {
              ...p,
              connected: status?.connected ?? false,
              lastSync: status?.lastSync,
            };
          }),
        );
      }
    } catch {
      // Fallback: show all as disconnected
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Integrações</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Conecte suas plataformas de marketing e analytics</p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-700 disabled:opacity-30 transition-colors"
          title="Verificar status"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 animate-pulse">
              <div className="h-5 w-32 bg-zinc-100 rounded mb-2" />
              <div className="h-3 w-48 bg-zinc-100 rounded mb-4" />
              <div className="h-8 w-24 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.platform}
              className={`rounded-xl border bg-white p-5 transition-colors ${
                integration.connected ? "border-emerald-200" : "border-zinc-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{integration.label}</h3>
                    {integration.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-zinc-300" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{integration.description}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  {integration.connected ? (
                    <span className="text-xs text-emerald-600 font-medium">Conectado</span>
                  ) : (
                    <span className="text-xs text-zinc-400">Não configurado</span>
                  )}
                  {integration.lastSync && (
                    <span className="text-[10px] text-zinc-400 ml-2">
                      Último sync: {new Date(integration.lastSync).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {!integration.connected && (
                  <div className="text-[10px] text-zinc-400">
                    Variáveis: {integration.envVars.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Como configurar</h3>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li>As integrações são configuradas via variáveis de ambiente no <code className="bg-blue-100 px-1 rounded">.env.local</code> (dev) ou painel Vercel (produção).</li>
          <li>Em breve: configuração via OAuth diretamente nesta página.</li>
          <li>Cada plataforma é independente — o dashboard mostra dados parciais se apenas algumas estiverem configuradas.</li>
        </ul>
      </div>
    </div>
  );
}
