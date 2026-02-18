"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/sidebar";
import Header from "@/components/ui/header";
import ErrorBoundary from "@/components/ui/error-boundary";
import AskAnalytics from "@/components/intelligence/ask-analytics";
import { defaultRange } from "@/lib/constants";

const pageTitles: Record<string, string> = {
  "/overview": "Visão Geral",
  "/planning": "Planejamento",
  "/acquisition/google": "Google Ads",
  "/acquisition/meta": "Meta Ads",
  "/acquisition/segments": "Segmentação",
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

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("ca_sidebar_collapsed") === "1";
  } catch {
    return false;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [tenantName] = useState(readTenantName);
  const dateRange = useMemo(() => defaultRange(), []);

  const title = pageTitles[pathname] ?? "Dashboard";

  function toggleCollapse() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("ca_sidebar_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar — desktop */}
      <div className="hidden lg:block shrink-0">
        <div className="fixed inset-y-0 left-0 z-30">
          <Sidebar
            tenantName={tenantName}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleCollapse}
          />
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
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        <Header
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-auto">
          <div className="px-6 pt-4">
            <AskAnalytics dateRange={dateRange} />
          </div>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
