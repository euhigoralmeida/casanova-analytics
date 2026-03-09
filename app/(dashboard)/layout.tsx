"use client";

import { useEffect, useMemo, useState } from "react";
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
  "/retention/rfm": "Análise RFM",
  "/retention/cohorts": "Cohorts de Recompra",
  "/funnel": "CRO & Funil",
  "/organic": "Inteligencia Organica",
  "/instagram": "Instagram",
  "/influencers": "Influenciadores",
  "/influencers/comparar": "Comparar Influenciadores",
  "/influencers/consultor": "Consultor Estratégico",
  "/alerts": "Alertas",
  "/settings": "Configurações",
};

type TenantData = { id?: string; name?: string; logo?: string };

function readTenantData(): TenantData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem("ca_tenant");
    if (!raw) return {};
    return JSON.parse(raw) as TenantData;
  } catch {
    return {};
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
  const [tenantData] = useState(readTenantData);
  const [globalRole, setGlobalRole] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const dateRange = useMemo(() => defaultRange(), []);

  // Fetch globalRole + role from server (not stored client-side)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.globalRole) setGlobalRole(data.user.globalRole);
        if (data.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  const title = pageTitles[pathname]
    ?? (pathname.startsWith("/influencers/") && !pathname.includes("/comparar") && !pathname.includes("/consultor")
      ? "Perfil do Influenciador"
      : "Dashboard");

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
            tenantId={tenantData.id}
            tenantName={tenantData.name}
            tenantLogo={tenantData.logo}
            globalRole={globalRole}
            userRole={userRole}
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
            <Sidebar tenantId={tenantData.id} tenantName={tenantData.name} tenantLogo={tenantData.logo} globalRole={globalRole} userRole={userRole} onClose={() => setSidebarOpen(false)} />
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
          globalRole={globalRole}
          activeTenantId={tenantData.id}
          activeTenantName={tenantData.name}
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
