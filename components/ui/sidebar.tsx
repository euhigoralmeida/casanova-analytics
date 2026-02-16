"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Megaphone,
  Heart,
  Filter,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  { label: "Visão Geral", href: "/overview", icon: LayoutDashboard },
  { label: "Planejamento", href: "/planning", icon: CalendarDays },
  {
    label: "Aquisição",
    icon: Megaphone,
    children: [
      { label: "Google Ads", href: "/acquisition/google" },
      { label: "Meta Ads", href: "/acquisition/meta" },
      { label: "Segmentação", href: "/acquisition/segments" },
    ],
  },
  { label: "Retenção", href: "/retention", icon: Heart },
  { label: "Funil", href: "/funnel", icon: Filter },
  { label: "Alertas", href: "/alerts", icon: Bell },
  { label: "Configurações", href: "/settings", icon: Settings },
];

export default function Sidebar({ tenantName, onClose }: { tenantName?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    // Auto-expand parent if current route is a child
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children?.some((child) => pathname.startsWith(child.href))) {
        initial[item.label] = true;
      }
    }
    return initial;
  });

  function toggleMenu(label: string) {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function navigate(href: string) {
    router.push(href);
    onClose?.();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("ca_tenant");
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href;
  }

  function isParentActive(item: NavItem) {
    if (item.children) {
      return item.children.some((child) => pathname.startsWith(child.href));
    }
    return false;
  }

  return (
    <aside className="flex flex-col h-full w-60 bg-white border-r border-zinc-200">
      {/* Logo + Tenant */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
        <Image src="/logo-casanova.png" alt="Casanova Analytics" width={140} height={36} priority />
        {tenantName && (
          <p className="text-xs text-zinc-500 mt-2 truncate">{tenantName}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = !!item.children;
          const parentActive = isParentActive(item);
          const expanded = expandedMenus[item.label] ?? false;

          if (hasChildren) {
            return (
              <div key={item.label}>
                {/* Parent item (toggle) */}
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                    parentActive
                      ? "text-emerald-700"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Icon size={18} strokeWidth={parentActive ? 2.2 : 1.8} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Children */}
                {expanded && (
                  <div className="ml-4 pl-4 border-l border-zinc-100 space-y-0.5 mt-0.5">
                    {item.children!.map((child) => {
                      const childActive = isActive(child.href);
                      return (
                        <a
                          key={child.href}
                          href={child.href}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(child.href);
                          }}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            childActive
                              ? "bg-emerald-50 text-emerald-700 font-medium"
                              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}
                        >
                          {child.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Simple item (no children)
          const active = isActive(item.href!);
          return (
            <a
              key={item.href}
              href={item.href!}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.href!);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-zinc-100 pt-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 w-full transition-colors"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}
