"use client";

import AdminSidebar from "@/components/ui/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <div className="hidden lg:block shrink-0">
        <div className="fixed inset-y-0 left-0 z-30">
          <AdminSidebar />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center px-6 shrink-0">
          <h1 className="text-base font-semibold text-zinc-900">Administração</h1>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
