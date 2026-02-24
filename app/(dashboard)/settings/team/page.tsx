"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, Users, Shield, Eye, Pencil } from "lucide-react";

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  lastLoginAt: string | null;
  createdAt: string;
};

const roleConfig = {
  admin: { label: "Admin", icon: Shield, color: "text-red-700 bg-red-50 border-red-200" },
  editor: { label: "Editor", icon: Pencil, color: "text-blue-700 bg-blue-50 border-blue-200" },
  viewer: { label: "Visualizador", icon: Eye, color: "text-zinc-600 bg-zinc-50 border-zinc-200" },
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `${inviteEmail} adicionado com sucesso` });
        setInviteEmail("");
        setInviteName("");
        setInviteRole("viewer");
        setShowInvite(false);
        loadMembers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erro ao adicionar" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Equipe</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie os membros da sua equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMembers}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-white hover:text-zinc-700 disabled:opacity-30 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm font-medium ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4">Adicionar membro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Nome"
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {inviting ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-800">
            Membros
            <span className="ml-2 text-zinc-400 font-normal">{members.length}</span>
          </h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-32 bg-zinc-100 rounded" />
                  <div className="h-3 w-48 bg-zinc-100 rounded" />
                </div>
                <div className="h-6 w-20 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500">Nenhum membro cadastrado no banco de dados.</p>
            <p className="text-xs text-zinc-400 mt-1">Execute o seed para migrar o usuário padrão.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {members.map((member) => {
              const config = roleConfig[member.role] ?? roleConfig.viewer;
              const RoleIcon = config.icon;
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-500">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{member.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{member.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${config.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                  {member.lastLoginAt && (
                    <span className="text-[10px] text-zinc-400 hidden sm:block">
                      Último login: {new Date(member.lastLoginAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Permissões</h3>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li><strong>Admin</strong> — Acesso total: configurações, integrações, equipe, todos os módulos.</li>
          <li><strong>Editor</strong> — Acesso a todos os módulos e planejamento. Sem acesso a configurações de equipe.</li>
          <li><strong>Visualizador</strong> — Somente leitura em todos os módulos.</li>
        </ul>
      </div>
    </div>
  );
}
