"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/sidebar";
import Header from "@/components/ui/header";

const pageTitles: Record<string, string> = {
  "/overview": "Visão Geral",
  "/planning": "Planejamento",
  "/acquisition/google": "Google Ads",
  "/acquisition/meta": "Meta Ads",
  "/retention": "Retenção",
  "/funnel": "Funil E-commerce",
  "/alerts": "Alertas",
  "/settings": "Configurações",
};

function readTenantName(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("ca_tenant");
    if (!raw) return undefined;
    return JSON.parse(raw)?.name;
  } catch {
    return undefined;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName] = useState(readTenantName);

  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar — desktop */}
      <div className="hidden lg:block shrink-0">
        <div className="fixed inset-y-0 left-0 z-30">
          <Sidebar tenantName={tenantName} />
        </div>
      </div>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar tenantName={tenantName} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <Header
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
