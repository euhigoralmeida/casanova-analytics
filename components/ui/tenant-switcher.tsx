"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";

type TenantInfo = { id: string; name: string; slug: string };

export default function TenantSwitcher({
  activeTenantId,
  activeTenantName,
}: {
  activeTenantId: string;
  activeTenantName: string;
}) {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch tenants when opening
  useEffect(() => {
    if (!open || tenants.length > 0) return;
    setLoading(true);
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((data) => setTenants(data.tenants ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, tenants.length]);

  async function switchTo(tenant: TenantInfo) {
    if (tenant.id === activeTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/admin/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("ca_tenant", JSON.stringify(data.tenant));
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-700 transition-colors disabled:opacity-50"
      >
        <Building2 size={15} className="text-zinc-400" />
        <span className="max-w-[160px] truncate">{activeTenantName}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg border border-zinc-200 shadow-lg z-50 py-1">
          {loading ? (
            <div className="px-3 py-2 text-sm text-zinc-400">Carregando...</div>
          ) : tenants.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-400">Nenhum tenant</div>
          ) : (
            tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTo(t)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 transition-colors"
              >
                <span className="flex-1 truncate">{t.name}</span>
                {t.id === activeTenantId && (
                  <Check size={14} className="text-emerald-600 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
