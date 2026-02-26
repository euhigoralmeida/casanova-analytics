"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Plug,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
} from "lucide-react";

type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
  active: boolean;
  primaryColor: string | null;
  onboardingStatus: string;
  createdAt: string;
  updatedAt: string;
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    globalRole: string | null;
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  integrations: {
    id: string;
    platform: string;
    label: string | null;
    active: boolean;
    lastSyncAt: string | null;
    createdAt: string;
  }[];
};

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  meta_ads: "Meta Ads",
  google_search_console: "Google Search Console",
  clarity: "Microsoft Clarity",
  instagram: "Instagram",
};

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingDashboard, setSwitchingDashboard] = useState(false);

  const loadTenant = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao carregar tenant");
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  async function viewDashboard() {
    if (!tenant) return;
    setSwitchingDashboard(true);
    try {
      const res = await fetch("/api/admin/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("ca_tenant", JSON.stringify(data.tenant));
        router.push("/overview");
      }
    } catch {
      // ignore
    } finally {
      setSwitchingDashboard(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Link
          href="/admin/tenants"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6"
        >
          <ArrowLeft size={14} />
          Voltar para Clientes
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-sm text-red-700">{error || "Tenant não encontrado"}</p>
        </div>
      </div>
    );
  }

  const onboardingLabel: Record<string, { text: string; color: string }> = {
    pending: { text: "Pendente", color: "bg-amber-100 text-amber-700" },
    integrations: { text: "Configurando", color: "bg-blue-100 text-blue-700" },
    complete: { text: "Completo", color: "bg-emerald-100 text-emerald-700" },
  };

  const ob = onboardingLabel[tenant.onboardingStatus] ?? onboardingLabel.pending;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft size={14} />
        Voltar para Clientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center">
            <Building2 size={24} className="text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{tenant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500">
                {tenant.slug}
              </code>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tenant.plan === "enterprise"
                    ? "bg-purple-100 text-purple-700"
                    : tenant.plan === "pro"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {tenant.plan}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.color}`}>
                {ob.text}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={viewDashboard}
          disabled={switchingDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {switchingDashboard ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ExternalLink size={14} />
          )}
          Ver Dashboard
        </button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Calendar size={14} />
            Criado em
          </div>
          <p className="text-sm font-medium text-zinc-900">
            {new Date(tenant.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Users size={14} />
            Usuários
          </div>
          <p className="text-sm font-medium text-zinc-900">{tenant.users.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Plug size={14} />
            Integrações ativas
          </div>
          <p className="text-sm font-medium text-zinc-900">
            {tenant.integrations.filter((i) => i.active).length}
          </p>
        </div>
      </div>

      {/* Integrations */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Integrações</h2>
        </div>
        {tenant.integrations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
            Nenhuma integração configurada
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {tenant.integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {integration.active ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <XCircle size={16} className="text-zinc-300" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {PLATFORM_LABELS[integration.platform] || integration.platform}
                    </p>
                    {integration.label && (
                      <p className="text-xs text-zinc-400">{integration.label}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {integration.lastSyncAt ? (
                    <p className="text-xs text-zinc-400">
                      Último sync: {new Date(integration.lastSyncAt).toLocaleDateString("pt-BR")}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">Sem sync</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Usuários</h2>
        </div>
        {tenant.users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
            Nenhum usuário cadastrado
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {tenant.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{user.name}</p>
                    <p className="text-xs text-zinc-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full text-zinc-600">
                    {user.role}
                  </span>
                  {user.lastLoginAt && (
                    <p className="text-xs text-zinc-400">
                      Último login: {new Date(user.lastLoginAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
