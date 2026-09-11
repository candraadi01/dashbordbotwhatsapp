"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/services/authService";
import { UserRole } from "@/types";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authService.getSession();
        
        if (!session) {
          router.replace("/login");
          return;
        }

        const role = await authService.getUserRole();
        
        if (!role) {
          // Fallback, if they are logged in but don't have a role in user_roles table
          // You could optionally sign them out or show an error
          router.replace("/login");
          return;
        }

        setUserRole(role);

        // RBAC Check
        // OWNER: Full access
        // ADMIN: Cannot access /dashboard/settings/users
        // STAFF: Cannot access /dashboard/reports, /dashboard/settings, /dashboard/settings/users
        
        if (role === 'ADMIN') {
          if (pathname.includes('/dashboard/settings/users')) {
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
        }

        if (role === 'STAFF') {
          if (
            pathname.includes('/dashboard/reports') ||
            pathname.includes('/dashboard/settings') ||
            pathname.includes('/dashboard/finance') ||
            pathname.includes('/dashboard/products')
          ) {
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Auth Guard Error:", error);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-slate-400 font-medium">Memeriksa otorisasi...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4">
        <div className="bg-white border border-red-500/20 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-500 text-3xl">!</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Access Denied</h1>
          <p className="text-slate-400 text-sm">
            Maaf, role Anda (<strong className="text-indigo-400">{userRole}</strong>) tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-950 rounded-lg transition-colors w-full font-medium"
          >
            Kembali ke Overview
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
