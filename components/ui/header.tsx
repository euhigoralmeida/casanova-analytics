"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, ArrowLeft, Loader2 } from "lucide-react";
import TenantSwitcher from "@/components/ui/tenant-switcher";

export default function Header({
  title,
  sidebarOpen,
  onToggleSidebar,
  globalRole,
  activeTenantId,
  activeTenantName,
}: {
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  globalRole?: string | null;
  activeTenantId?: string;
  activeTenantName?: string;
}) {
  const router = useRouter();
  const [returning, setReturning] = useState(false);
  const isAdmin = globalRole === "platform_admin";
  const showSwitcher = isAdmin && activeTenantId && activeTenantName;

  async function handleBackToAdmin() {
    setReturning(true);
    try {
      // Clear activeTenantId by switching to own tenant (the API handles this)
      const res = await fetch("/api/admin/clear-impersonation", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.removeItem("ca_tenant");
        router.push("/admin");
      }
    } catch {
      // fallback: just navigate
      router.push("/admin");
    } finally {
      setReturning(false);
    }
  }

  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600"
        aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <h1 className="text-base font-semibold text-zinc-900 truncate">{title}</h1>

      <div className="flex-1" />

      {isAdmin && (
        <button
          onClick={handleBackToAdmin}
          disabled={returning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {returning ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeft size={12} />}
          Voltar ao Admin
        </button>
      )}

      {showSwitcher && (
        <TenantSwitcher
          activeTenantId={activeTenantId}
          activeTenantName={activeTenantName}
        />
      )}
    </header>
  );
}
