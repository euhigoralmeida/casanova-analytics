"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Building2,
  Users,
  Plug,
  Loader2,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
  createdAt: string;
  _count: { users: number; integrations: number };
};

type CreateForm = {
  name: string;
  slug: string;
  plan: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  autoPassword: boolean;
};

const INITIAL_FORM: CreateForm = {
  name: "",
  slug: "",
  plan: "pro",
  adminEmail: "",
  adminName: "",
  adminPassword: "",
  autoPassword: true,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tenant: { name: string; slug: string };
    user: { email: string };
    tempPassword?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  function updateForm(field: keyof CreateForm, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && typeof value === "string") {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  async function handleCreate() {
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          adminEmail: form.adminEmail,
          adminName: form.adminName,
          adminPassword: form.autoPassword ? undefined : form.adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar tenant");
        return;
      }

      setResult(data);
      loadTenants();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm(INITIAL_FORM);
    setError("");
    setResult(null);
    setCopied(false);
    setShowPassword(false);
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function viewDashboard(tenant: TenantRow) {
    setSwitchingId(tenant.id);
    try {
      const res = await fetch("/api/admin/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("ca_tenant", JSON.stringify(data.tenant));
        router.push("/overview");
      }
    } catch {
      // ignore
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Clientes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Gerencie os tenants da plataforma
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={16} />
          Novo Cliente
        </button>
      </div>

      {/* Tenants Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">
          Nenhum tenant encontrado
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">
                  Empresa
                </th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">
                  Plano
                </th>
                <th className="text-center px-4 py-3 font-medium text-zinc-600">
                  <Users size={14} className="inline mr-1" />
                  Usuários
                </th>
                <th className="text-center px-4 py-3 font-medium text-zinc-600">
                  <Plug size={14} className="inline mr-1" />
                  Integrações
                </th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">
                  Criado em
                </th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <div className="flex items-center gap-2">
                      <Building2
                        size={16}
                        className="text-zinc-400 shrink-0"
                      />
                      {t.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                      {t.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.plan === "enterprise"
                          ? "bg-purple-100 text-purple-700"
                          : t.plan === "pro"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">
                    {t._count.users}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">
                    {t._count.integrations}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="text-xs px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition-colors"
                      >
                        Detalhes
                      </Link>
                      <button
                        onClick={() => viewDashboard(t)}
                        disabled={switchingId === t.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {switchingId === t.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ExternalLink size={12} />
                        )}
                        Ver Dashboard
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">
                {result ? "Cliente Criado" : "Novo Cliente"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {result ? (
              /* Success state */
              <div className="px-6 py-5 space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                  <p className="text-sm font-medium text-emerald-800">
                    Tenant &ldquo;{result.tenant.name}&rdquo; criado com
                    sucesso!
                  </p>
                  <p className="text-xs text-emerald-700">
                    Slug: <code>{result.tenant.slug}</code>
                  </p>
                  <p className="text-xs text-emerald-700">
                    Admin: {result.user.email}
                  </p>
                </div>

                {result.tempPassword && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                    <p className="text-sm font-semibold text-amber-800">
                      Senha temporária gerada
                    </p>
                    <p className="text-xs text-amber-700">
                      Compartilhe esta senha com o cliente. Ela não será exibida
                      novamente.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 bg-white border border-amber-200 px-3 py-2 rounded-lg text-sm font-mono text-amber-900">
                        {result.tempPassword}
                      </code>
                      <button
                        onClick={() => copyToClipboard(result.tempPassword!)}
                        className="p-2 rounded-lg border border-amber-200 hover:bg-amber-100 text-amber-700 transition-colors"
                        title="Copiar"
                      >
                        {copied ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={closeModal}
                  className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              /* Form */
              <div className="px-6 py-5 space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Nome da empresa *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Casanova E-commerce"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => updateForm("slug", e.target.value)}
                    placeholder="casanova"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    3-30 caracteres, apenas letras minúsculas, números e hífens
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Plano
                  </label>
                  <select
                    value={form.plan}
                    onChange={(e) => updateForm("plan", e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <hr className="border-zinc-100" />

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Email do admin *
                  </label>
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => updateForm("adminEmail", e.target.value)}
                    placeholder="admin@empresa.com.br"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Nome do admin
                  </label>
                  <input
                    type="text"
                    value={form.adminName}
                    onChange={(e) => updateForm("adminName", e.target.value)}
                    placeholder="João Silva"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoPassword}
                      onChange={(e) =>
                        updateForm("autoPassword", e.target.checked)
                      }
                      className="rounded border-zinc-300"
                    />
                    Gerar senha automaticamente
                  </label>
                </div>

                {!form.autoPassword && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={(e) =>
                          updateForm("adminPassword", e.target.value)
                        }
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-3 py-2 pr-10 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !form.name || !form.slug || !form.adminEmail || (!form.autoPassword && form.adminPassword.length < 6)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    Criar Cliente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
