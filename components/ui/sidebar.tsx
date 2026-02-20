"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  Megaphone,
  Heart,
  MousePointerClick,
  Instagram,
  Users,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Image from "next/image";

type ChildItem = { label: string; href: string; comingSoon?: boolean };

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  comingSoon?: boolean;
  children?: ChildItem[];
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
      { label: "TikTok Ads", href: "/acquisition/tiktok", comingSoon: true },
      { label: "Segmentação", href: "/acquisition/segments" },
    ],
  },
  { label: "Retenção", href: "/retention", icon: Heart },
  { label: "CRO (Beta)", href: "/funnel", icon: MousePointerClick },
  { label: "Instagram", href: "/instagram", icon: Instagram },
  { label: "Influenciadores (Beta)", href: "/influencers", icon: Users },
  { label: "Alertas", href: "/alerts", icon: Bell },
  { label: "Configurações", href: "/settings", icon: Settings },
];

function ComingSoonBadge() {
  return (
    <span className="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full leading-none">
      Em breve
    </span>
  );
}

export default function Sidebar({
  tenantName,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  tenantName?: string;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
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
    <aside
      className={`flex flex-col h-full bg-white border-r border-zinc-200 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo + Tenant */}
      <div className={`border-b border-zinc-100 ${collapsed ? "px-2 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
        {collapsed ? (
          <div className="flex justify-center">
            <Image src="/logo-casanova.png" alt="Casanova Analytics" width={32} height={32} priority className="object-contain" />
          </div>
        ) : (
          <>
            <Image src="/logo-casanova.png" alt="Casanova Analytics" width={140} height={36} priority />
            {tenantName && (
              <p className="text-xs text-zinc-500 mt-2 truncate">{tenantName}</p>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${collapsed ? "px-1.5" : "px-3"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = !!item.children;
          const parentActive = isParentActive(item);
          const expanded = expandedMenus[item.label] ?? false;

          if (hasChildren) {
            if (collapsed) {
              // Collapsed: show parent icon only, click navigates to first non-coming-soon child
              const firstChild = item.children!.find((c) => !c.comingSoon);
              const active = parentActive;
              return (
                <Link
                  key={item.label}
                  href={firstChild?.href ?? "#"}
                  onClick={() => onClose?.()}
                  title={item.label}
                  className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                </Link>
              );
            }

            return (
              <div key={item.label}>
                {/* Parent item (toggle) */}
                <button
                  onClick={() => toggleMenu(item.label)}
                  aria-expanded={expanded}
                  aria-controls={`submenu-${item.label}`}
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
                  <div id={`submenu-${item.label}`} className="ml-4 pl-4 border-l border-zinc-100 space-y-0.5 mt-0.5">
                    {item.children!.map((child) => {
                      if (child.comingSoon) {
                        return (
                          <span
                            key={child.href}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 cursor-default"
                          >
                            {child.label}
                            <ComingSoonBadge />
                          </span>
                        );
                      }
                      const childActive = isActive(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => onClose?.()}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            childActive
                              ? "bg-emerald-50 text-emerald-700 font-medium"
                              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Simple item (no children)
          if (item.comingSoon) {
            if (collapsed) {
              return (
                <span
                  key={item.href}
                  title={item.label}
                  className="flex items-center justify-center p-2.5 rounded-lg text-zinc-400 cursor-default"
                >
                  <Icon size={18} strokeWidth={1.8} />
                </span>
              );
            }
            return (
              <span
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 cursor-default"
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
                <ComingSoonBadge />
              </span>
            );
          }

          const active = isActive(item.href!);

          if (collapsed) {
            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={() => onClose?.()}
                title={item.label}
                className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => onClose?.()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Collapse toggle + Logout */}
      <div className={`border-t border-zinc-100 pt-2 pb-4 ${collapsed ? "px-1.5" : "px-3"} space-y-0.5`}>
        {/* Collapse toggle — desktop only */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={`flex items-center rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 w-full transition-colors ${
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
            }`}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
            {!collapsed && <span>Recolher</span>}
          </button>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 w-full transition-colors ${
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
        >
          <LogOut size={18} strokeWidth={1.8} />
          {!collapsed && "Sair"}
        </button>
      </div>
    </aside>
  );
}
