"use client";

import React, { useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Database,
  User,
  LayoutDashboard,
  Server,
  CheckCircle2,
  Clock,
  Save,
  RefreshCw,
  XCircle,
  Activity,
  Gauge,
  Gift,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { useSettings } from "@/hooks/useSettings";
import { authService } from "@/services/authService";
import { DataMaintenance } from "@/components/settings/data-maintenance";

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  
  // 1. Admin Profile State
  const [lastLogin, setLastLogin] = useState<string>("Loading...");

  // 2. System Status
  const [dbStatus, setDbStatus] = useState<"checking" | "online" | "offline">("checking");
  
  // 3. Database Summary
  const [dbSummary, setDbSummary] = useState({
    customers: 0,
    transactions: 0,
    products: 0,
    lastSync: "Checking...",
  });

  // 4. Realtime Activity
   
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // 5. Application Config
  const [appConfig, setAppConfig] = useState({
    dashboardName: "CANDRA Admin CRM",
    currency: "IDR",
    timezone: "Asia/Jakarta",
  });

  const fetchDbSummary = useCallback(async () => {
      try {
        const [
          { count: custCount, error: custErr },
          { count: trxCount, error: trxErr },
          products
        ] = await Promise.all([
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase.from("transactions").select("*", { count: "exact", head: true }),
          import("@/services/productService").then(m => m.productService.getProducts())
        ]);

        if (custErr || trxErr) throw new Error("Failed to fetch counts");

        setDbSummary({
          customers: custCount || 0,
          transactions: trxCount || 0,
          products: products.length,
          lastSync: new Date().toLocaleTimeString("id-ID"),
        });
        setDbStatus("online");
      } catch (err) {
        console.error("Supabase ping/fetch failed:", err);
        setDbStatus("offline");
        setDbSummary(prev => ({ ...prev, lastSync: "Failed to connect" }));
      }
  }, []);

  useEffect(() => {
    // Set Last Login to current time on mount
    setLastLogin(new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }));
    authService.isOwner().then(setIsOwner).catch(() => setIsOwner(false));

    fetchDbSummary();

    // Subscribe to Realtime Activities
    const channel = transactionRealtimeService.subscribeTransactions((payload) => {
      const newData = payload.new;
      if (newData && typeof newData === 'object' && 'customer_name' in newData) {
        setRecentActivities(prev => {
          const newActivities = [newData, ...prev].slice(0, 5); // Keep last 5
          return newActivities;
        });
      }
    });

    return () => {
      transactionRealtimeService.unsubscribe(channel);
    };
  }, [fetchDbSummary]);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate saving app config locally (no DB save as requested)
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-indigo-400" /> Pengaturan Sistem
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Konfigurasi aplikasi, database, dan informasi sistem.
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving || isSaved}
          className={`text-slate-950 transition-all ${
            isSaved ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          {isSaving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Menyimpan..." : isSaved ? "Tersimpan!" : "Simpan Perubahan"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Admin Profile */}
        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <User className="h-5 w-5 text-amber-400" /> Admin Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Nama Admin</span>
              <span className="text-sm text-slate-950 font-semibold">Candra Admin</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Role Akses</span>
              <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                Super Admin
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Aktif
              </Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-slate-700">Last Login</span>
              <div className="flex items-center text-sm text-slate-400">
                <Clock className="mr-1.5 h-3.5 w-3.5" /> {lastLogin}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. System Status Card */}
        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Server className="h-5 w-5 text-emerald-400" /> System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Supabase Connection</span>
              {dbStatus === "checking" ? (
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Checking
                </Badge>
              ) : dbStatus === "online" ? (
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Online
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20">
                  <XCircle className="mr-1 h-3 w-3" /> Offline
                </Badge>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Realtime Connection</span>
              {dbStatus === "online" ? (
                <Badge variant="success" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  Waiting
                </Badge>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Database Status</span>
              <span className="text-sm text-slate-400">{dbStatus === "online" ? "Healthy" : "Unreachable"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-slate-700">Application Status</span>
              <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Running
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 3. Database Summary */}
        <Card className="border-slate-200 bg-white backdrop-blur-xl md:col-span-2 lg:col-span-1">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-400" /> Database Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Total Customer</span>
              <span className="text-sm text-slate-950 font-semibold">{dbSummary.customers.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Total Transaction</span>
              <span className="text-sm text-slate-950 font-semibold">{dbSummary.transactions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Total Product</span>
              <span className="text-sm text-slate-950 font-semibold">{dbSummary.products.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-slate-700">Last Data Sync</span>
              <div className="flex items-center text-sm text-slate-400">
                <Clock className="mr-1.5 h-3.5 w-3.5" /> {dbSummary.lastSync}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Realtime Activity Panel */}
        <Card className="border-slate-200 bg-white backdrop-blur-xl md:col-span-2 lg:col-span-1">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Activity className="h-5 w-5 text-pink-400" /> Realtime Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-slate-600 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Menunggu transaksi baru secara live...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex flex-col border-b border-slate-200/40 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-slate-950">{activity.customer_name || 'Pelanggan'}</span>
                      <span className="text-xs text-slate-400">
                        {activity.created_at ? new Date(activity.created_at).toLocaleTimeString('id-ID') : 'Baru saja'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 truncate max-w-[180px]">{activity.product_name}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 h-5 ${
                          activity.status === 'success' 
                            ? 'text-emerald-400 border-emerald-400/30' 
                            : activity.status === 'pending'
                              ? 'text-amber-400 border-amber-400/30'
                              : 'text-red-400 border-red-400/30'
                        }`}
                      >
                        {activity.status || 'unknown'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Application Config */}
        {isOwner && <DataMaintenance onComplete={fetchDbSummary} />}

        <Card className="border-slate-200 bg-white backdrop-blur-xl md:col-span-2">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <User className="h-5 w-5 text-indigo-500" /> Fitur Customer CRM
            </CardTitle>
            <p className="text-xs leading-5 text-slate-500">
              Pilih informasi yang ingin ditampilkan pada halaman Customer CRM. Data lama tetap aman saat fitur disembunyikan.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                <Gauge className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">Score Customer</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">Tampilkan nilai score 0–100 di daftar customer.</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.customerScoreEnabled}
                onChange={(event) => updateSetting("customerScoreEnabled", event.target.checked)}
              />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-indigo-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-amber-200 hover:bg-amber-50/50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
                <Gift className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">Poin Reward</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">Tampilkan saldo poin, diskon, dan tombol kelola poin.</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.customerPointsEnabled}
                onChange={(event) => updateSetting("customerPointsEnabled", event.target.checked)}
              />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-amber-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl md:col-span-2">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-purple-400" /> Application Config
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-slate-200/40 gap-4">
              <span className="text-sm font-medium text-slate-700">Dashboard Name</span>
              <input 
                type="text"
                className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                value={appConfig.dashboardName}
                onChange={(e) => setAppConfig(prev => ({ ...prev, dashboardName: e.target.value }))}
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Currency</span>
              <select 
                className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-32"
                value={appConfig.currency}
                onChange={(e) => setAppConfig(prev => ({ ...prev, currency: e.target.value }))}
              >
                <option value="IDR">IDR (Rupiah)</option>
                <option value="USD">USD (Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <span className="text-sm font-medium text-slate-700">Timezone</span>
              <select 
                className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-48"
                value={appConfig.timezone}
                onChange={(e) => setAppConfig(prev => ({ ...prev, timezone: e.target.value }))}
              >
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-200/40">
              <div>
                <p className="text-sm font-medium text-slate-700">Enable Realtime Notification</p>
                <p className="text-xs text-slate-500">Menerima notifikasi langsung di header</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.notificationEnabled}
                  onChange={(e) => updateSetting("notificationEnabled", e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Sound Alert</p>
                <p className="text-xs text-slate-500">Bunyi notifikasi (beep) saat ada aktivitas baru</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.soundAlert}
                  onChange={(e) => updateSetting("soundAlert", e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
