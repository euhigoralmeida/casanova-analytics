"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Settings2,
  Unplug,
} from "lucide-react";

type IntegrationStatus = {
  platform: string;
  label: string;
  description: string;
  connected: boolean;
  lastSync?: string;
};

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  optional?: boolean;
};

const PLATFORM_FIELDS: Record<string, FieldDef[]> = {
  google_ads: [
    { key: "developer_token", label: "Developer Token", type: "password" },
    { key: "client_id", label: "Client ID", type: "text" },
    { key: "client_secret", label: "Client Secret", type: "password" },
    { key: "refresh_token", label: "Refresh Token", type: "password" },
    { key: "customer_id", label: "Customer ID", type: "text", placeholder: "123-456-7890" },
    { key: "login_customer_id", label: "Login Customer ID (MCC)", type: "text", optional: true },
  ],
  ga4: [
    { key: "property_id", label: "Property ID", type: "text", placeholder: "123456789" },
    { key: "client_email", label: "Client Email (Service Account)", type: "text", placeholder: "sa@project.iam.gserviceaccount.com" },
    { key: "private_key", label: "Private Key", type: "textarea", placeholder: "-----BEGIN PRIVATE KEY-----\n..." },
  ],
  meta_ads: [
    { key: "access_token", label: "Access Token", type: "password" },
    { key: "account_id", label: "Account ID", type: "text", placeholder: "act_123456789" },
  ],
  google_search_console: [
    { key: "site_url", label: "Site URL", type: "text", placeholder: "https://www.exemplo.com.br" },
    { key: "client_email", label: "Client Email (Service Account)", type: "text" },
    { key: "private_key", label: "Private Key", type: "textarea", placeholder: "-----BEGIN PRIVATE KEY-----\n..." },
  ],
  clarity: [
    { key: "project_id", label: "Project ID", type: "text" },
    { key: "api_token", label: "API Token", type: "password" },
  ],
  instagram: [
    { key: "access_token", label: "Access Token", type: "password" },
    { key: "business_account_id", label: "Business Account ID", type: "text" },
  ],
  magazord: [
    { key: "username", label: "Username", type: "text", placeholder: "usuario@loja.com.br" },
    { key: "password", label: "Password", type: "password" },
    { key: "base_url", label: "Base URL", type: "text", placeholder: "https://api.magazord.com.br", optional: true },
  ],
};

const PLATFORMS: IntegrationStatus[] = [
  { platform: "google_ads", label: "Google Ads", description: "Campanhas Shopping, SKUs, ROAS, CPA, conversões", connected: false },
  { platform: "ga4", label: "Google Analytics 4", description: "Funil de conversão, sessões, aquisição por canal, retenção", connected: false },
  { platform: "meta_ads", label: "Meta Ads", description: "Campanhas Facebook/Instagram Ads, métricas de performance", connected: false },
  { platform: "google_search_console", label: "Google Search Console", description: "SEO orgânico, queries, páginas, impressões, cliques", connected: false },
  { platform: "clarity", label: "Microsoft Clarity", description: "CRO, dead/rage clicks, scroll depth, heatmaps", connected: false },
  { platform: "instagram", label: "Instagram Business", description: "Insights do perfil, publicações, audiência, crescimento", connected: false },
  { platform: "magazord", label: "Magazord", description: "CRM: pedidos, clientes, segmentação RFM, recompra, LTV", connected: false },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(PLATFORMS);
  const [loading, setLoading] = useState(true);
  const [editPlatform, setEditPlatform] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations((prev) =>
          prev.map((p) => {
            const status = data.integrations?.find((i: { platform: string }) => i.platform === p.platform);
            return { ...p, connected: status?.connected ?? false, lastSync: status?.lastSync };
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
    try {
      const user = JSON.parse(sessionStorage.getItem("ca_user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch {
      // not admin
    }
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEditModal(platform: string) {
    setEditPlatform(platform);
    setFormValues({});
    setError("");
    setSuccess("");
    setVisibleFields({});
  }

  function closeModal() {
    setEditPlatform(null);
    setFormValues({});
    setError("");
    setSuccess("");
    setVisibleFields({});
  }

  async function handleSave() {
    if (!editPlatform) return;
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: editPlatform, credentials: formValues }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar");
        return;
      }

      setSuccess("Credenciais salvas com sucesso!");
      loadStatus();
      setTimeout(closeModal, 1200);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect(platform: string) {
    if (!confirm("Tem certeza que deseja desconectar esta integração?")) return;

    try {
      const res = await fetch("/api/settings/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (res.ok) {
        loadStatus();
      }
    } catch {
      // ignore
    }
  }

  function toggleFieldVisibility(key: string) {
    setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const editFields = editPlatform ? PLATFORM_FIELDS[editPlatform] ?? [] : [];
  const editLabel = PLATFORMS.find((p) => p.platform === editPlatform)?.label ?? "";

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
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {integration.connected && (
                      <button
                        onClick={() => handleDisconnect(integration.platform)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        title="Desconectar"
                      >
                        <Unplug size={12} />
                        Desconectar
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(integration.platform)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      <Settings2 size={12} />
                      {integration.connected ? "Editar" : "Configurar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Como configurar</h3>
          <ul className="text-xs text-blue-800 space-y-1.5">
            <li>Entre em contato com o administrador para configurar as integrações da sua conta.</li>
            <li>Cada plataforma é independente — o dashboard mostra dados parciais se apenas algumas estiverem configuradas.</li>
          </ul>
        </div>
      )}

      {/* Edit/Configure Modal */}
      {editPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">
                Configurar {editLabel}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              {editFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {field.label}
                    {field.optional && <span className="text-zinc-400 font-normal"> (opcional)</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={formValues[field.key] ?? ""}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type === "password" && !visibleFields[field.key] ? "password" : "text"}
                        value={formValues[field.key] ?? ""}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 pr-10 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      {field.type === "password" && (
                        <button
                          type="button"
                          onClick={() => toggleFieldVisibility(field.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
                        >
                          {visibleFields[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Salvar Credenciais
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
