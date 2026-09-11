"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { AuthGuard } from "@/components/layout/AuthGuard";
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
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Customers CRM", href: "/dashboard/customers", icon: Users },
  { name: "Transactions", href: "/dashboard/transactions", icon: Receipt },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Reports", href: "/dashboard/reports", icon: PieChart },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const filteredNavigation = navigation.filter(item => {
    if (userRole === 'STAFF' && (item.name === 'Reports' || item.name === 'Settings')) return false;
    return true;
  });

  return (
    <div className="min-h-screen text-slate-900 flex flex-col md:flex-row antialiased">
      {/* Sidebar Desktop */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar / Mobile Nav */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-950 text-sm">CANDRA BOT</span>
          </div>

          {/* Nav Tabs Header */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 flex-1">
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
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            
            <div className="ml-auto pl-2 border-l border-slate-300 flex items-center gap-3">
              <NotificationCenter />
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 md:hidden p-1">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1480px] w-full mx-auto space-y-6">
          <AuthGuard>
            {children}
          </AuthGuard>
        </main>
      </div>
    </div>
  );
}
