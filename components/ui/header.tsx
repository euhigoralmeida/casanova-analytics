"use client";

import { Menu, X } from "lucide-react";
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
  const showSwitcher = globalRole === "platform_admin" && activeTenantId && activeTenantName;

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

      {showSwitcher && (
        <TenantSwitcher
          activeTenantId={activeTenantId}
          activeTenantName={activeTenantName}
        />
      )}
    </header>
  );
}
