"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Building2, LogOut } from "lucide-react";

const navItems = [
  { label: "Clientes", href: "/admin/tenants", icon: Building2 },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("ca_tenant");
    sessionStorage.removeItem("ca_user");
    router.push("/login");
  }

  return (
    <aside className="flex flex-col h-full w-60 bg-white border-r border-zinc-200">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
        <Image
          src="/logo-fivep.png"
          alt="FiveP Analytics"
          width={140}
          height={36}
          priority
          className="object-contain"
        />
        <p className="text-xs text-zinc-500 mt-2">Painel Administrativo</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* Bottom */}
      <div className="border-t border-zinc-100 px-3 pt-2 pb-4">
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
