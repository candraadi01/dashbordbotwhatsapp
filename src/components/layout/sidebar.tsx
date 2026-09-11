"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { UserRole } from "@/types";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Package,
  Settings,
  Bot,
  PieChart,
  Activity,
  LogOut,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Customers CRM", href: "/dashboard/customers", icon: Users },
  { name: "Transactions", href: "/dashboard/transactions", icon: Receipt },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Reports", href: "/dashboard/reports", icon: PieChart },
  { name: "Finance", href: "/dashboard/finance", icon: DollarSign },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    authService.getUserRole().then(setUserRole);
  }, []);

  const handleLogout = async () => {
    await authService.signOut();
    router.push("/login");
  };

  const filteredNavigation = navigation.filter((item) => {
    if (userRole === "STAFF" && (item.name === "Reports" || item.name === "Settings" || item.name === "Finance" || item.name === "Products"))
      return false;
    return true;
  });

  return (
    <aside className="sticky top-0 h-screen w-64 border-r border-slate-200/80 bg-white/90 backdrop-blur-xl p-4 flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-950 tracking-tight text-sm">
              CANDRA BOT
            </h2>
            <p className="text-[11px] text-slate-400">Admin Dashboard</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="space-y-3">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-2 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl border border-slate-200 transition-colors text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <p className="text-slate-700 font-semibold">Supabase Realtime</p>
          <p className="text-emerald-400 text-[11px] flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </p>
        </div>
      </div>
    </aside>
  );
}
