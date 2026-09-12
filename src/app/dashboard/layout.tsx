"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  MobileSidebar,
  getVisibleNavigation,
} from "@/components/layout/sidebar";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { authService } from "@/services/authService";
import { UserRole } from "@/types";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    authService.getUserRole().then(setUserRole);
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <div className="flex min-h-screen flex-col text-slate-900 antialiased md:flex-row">
      <Sidebar />
      <MobileSidebar open={mobileMenuOpen} onClose={closeMobileMenu} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-3 pr-16 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95"
              aria-label="Buka menu utama"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
                <Image
                  src="/brand/candra-bot-logo.png"
                  alt="Logo CANDRA BOT"
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight text-slate-950">CANDRA BOT</p>
                <p className="truncate text-xs font-medium text-slate-500">Admin Dashboard</p>
              </div>
            </div>
          </div>

          <div className="hidden min-h-16 items-center gap-2 overflow-x-auto px-4 py-2 pr-16 md:flex">
            {getVisibleNavigation(userRole).map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 border-l border-slate-200 pl-2 md:right-4 md:pl-3">
            <NotificationCenter />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] flex-1 space-y-4 sm:space-y-6 p-3 sm:p-6 lg:p-8 overflow-x-hidden">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}
