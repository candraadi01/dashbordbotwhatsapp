"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { dashboardService, PeriodFilter, ReportingData } from "@/services/dashboardService";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { formatIDR, cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewControls } from "@/components/dashboard/overview-controls";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BotInstanceRow } from "@/types";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Eye,
  EyeOff,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAlive(bot: BotInstanceRow | null, now: number) {
  return Boolean(bot && bot.status === "online" && now - new Date(bot.last_seen).getTime() < 90_000);
}

export default function DashboardPage() {
  const { settings, isLoaded } = useSettings();
  const [data, setData] = useState<ReportingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [liveTransactions, setLiveTransactions] = useState(0);
  const [period, setPeriod] = useState<PeriodFilter>("7days");
  const [dateRange, setDateRange] = useState(() => ({
    startDate: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    endDate: toDateInput(new Date()),
  }));
  const appliedSettings = useRef(false);
  const [bot, setBot] = useState<BotInstanceRow | null>(null);
  const [botNow, setBotNow] = useState(0);
  // Default true: saat halaman dibuka pertama kali, angka otomatis tertutup (ala m-banking)
  const [isMasked, setIsMasked] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem("candra_overview_masked_mode");
    } catch {
      // ignore
    }
  }, []);

  const toggleMasked = () => {
    setIsMasked((prev) => !prev);
  };

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await dashboardService.getReportingOverview(period, dateRange);
      setData(result);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ringkasan gagal dimuat.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange, period]);

  useEffect(() => {
    if (!isLoaded || appliedSettings.current) return;
    appliedSettings.current = true;
    setPeriod(settings.defaultPeriod);
  }, [isLoaded, settings.defaultPeriod]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadData();
    if (!settings.realtimeOn) return;

    const channel = transactionRealtimeService.subscribeTransactions((payload) => {
      if (payload.eventType === "INSERT") setLiveTransactions((current) => current + 1);
      window.setTimeout(() => void loadData(), 500);
    });
    return () => transactionRealtimeService.unsubscribe(channel);
  }, [isLoaded, loadData, settings.realtimeOn]);

  // Bot status realtime
  useEffect(() => {
    setBotNow(Date.now());
    const timer = window.setInterval(() => setBotNow(Date.now()), 10_000);

    void supabase
      .from("bot_instances")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: b }) => { if (b) setBot(b as BotInstanceRow); });

    const channel = supabase
      .channel("overview-bot-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_instances" }, (payload) => {
        if (payload.eventType === "DELETE") setBot(null);
        else setBot(payload.new as BotInstanceRow);
      })
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full max-w-md" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  const { metrics } = data;
  const successRate = metrics.totalTransactions > 0
    ? Math.round((metrics.successTransactions / metrics.totalTransactions) * 100)
    : 0;

  const statuses = [
    { label: "Berhasil", value: metrics.successTransactions, icon: CheckCircle2, style: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    { label: "Menunggu", value: metrics.pendingTransactions, icon: Clock3, style: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    { label: "Gagal", value: metrics.cancelledTransactions, icon: XCircle, style: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
    { label: "Hari ini", value: metrics.todayTransactions, icon: ShoppingCart, style: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 sm:space-y-5 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-600">
            <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-xl bg-indigo-50"><LayoutDashboard className="h-4 w-4" /></span>
            Ringkasan bisnis
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-950">Overview Penjualan</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">Pantau transaksi, omzet, dan keuntungan dari bot WhatsApp.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Realtime aktif */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold text-emerald-700 shadow-2xs">
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500" /></span>
            <span>Realtime{liveTransactions > 0 ? (isMasked ? " • •• baru" : ` • ${liveTransactions} baru`) : " aktif"}</span>
          </div>
          {/* Bot Status */}
          {(() => {
            const online = isAlive(bot, botNow);
            return (
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold shadow-2xs ${
                bot === null
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : online
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-600"
              }`}>
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                  {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />}
                  <span className={`relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${
                    bot === null ? "bg-slate-300" : online ? "bg-emerald-500" : "bg-rose-500"
                  }`} />
                </span>
                <span>WA Bot {bot === null ? "—" : online ? "Online" : "Offline"}</span>
              </div>
            );
          })()}
          {/* Tombol Fitur Mata (Sensor Angka ala M-Banking) */}
          <button
            type="button"
            onClick={toggleMasked}
            aria-label={isMasked ? "Tampilkan semua nominal angka" : "Sembunyikan nominal angka (mode privasi)"}
            className={cn(
              "group flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold shadow-2xs transition-all duration-200 cursor-pointer active:scale-95",
              isMasked
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600"
            )}
            title={isMasked ? "Klik untuk menampilkan angka & nominal" : "Klik untuk menyembunyikan angka & nominal (Mode privasi seperti perbankan)"}
          >
            {isMasked ? (
              <>
                <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 transition-transform group-hover:scale-110" />
                <span>Tampilkan Angka</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 group-hover:text-indigo-600 transition-transform group-hover:scale-110" />
                <span>Sembunyikan Angka</span>
              </>
            )}
          </button>
        </div>
      </header>

      <OverviewControls
        period={period}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        displayStartDate={data.startDate}
        displayEndDate={data.endDate}
        isRefreshing={isRefreshing}
        onPeriodChange={setPeriod}
        onDateChange={(field, value) => setDateRange((current) => ({ ...current, [field]: value }))}
      />

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:p-4 text-xs sm:text-sm text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />{loadError}</span>
          <button type="button" onClick={() => void loadData()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white"><RefreshCw className="h-4 w-4" /></button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Omzet"
          value={isMasked ? "Rp ••••••••" : formatIDR(metrics.totalRevenue)}
          description="Transaksi berhasil"
          icon={DollarSign}
          iconColor="border-indigo-100 bg-indigo-50 text-indigo-600"
          isMasked={isMasked}
        />
        <StatCard
          title="Profit"
          value={isMasked ? "Rp ••••••••" : formatIDR(metrics.totalProfit)}
          description={isMasked ? "Margin bersih ••%" : `Margin bersih ${metrics.averageProfitPercentage}%`}
          icon={TrendingUp}
          iconColor="border-emerald-100 bg-emerald-50 text-emerald-600"
          isMasked={isMasked}
        />
        <StatCard
          title="Transaksi"
          value={isMasked ? "••••" : metrics.totalTransactions}
          description={isMasked ? "••% berhasil diproses" : `${successRate}% berhasil diproses`}
          icon={Receipt}
          iconColor="border-blue-100 bg-blue-50 text-blue-600"
          isMasked={isMasked}
        />
        <StatCard
          title="Customer"
          value={isMasked ? "••••" : metrics.totalCustomers}
          description="Total pelanggan aktif"
          icon={Users}
          iconColor="border-violet-100 bg-violet-50 text-violet-600"
          isMasked={isMasked}
        />
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
            {statuses.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2.5 p-3 sm:gap-3.5 sm:p-5",
                    idx % 2 === 1 && "border-l border-slate-100 sm:border-l-0"
                  )}
                >
                  <span className={cn("grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-lg sm:rounded-xl", item.style)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-base sm:text-xl font-black text-slate-950 transition-all duration-200", isMasked && "tracking-widest font-mono text-slate-700 select-none")}>
                      {isMasked ? "•••" : item.value}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] sm:text-xs font-medium text-slate-500">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.dot)} />
                      <span className="truncate">{item.label}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.8fr)]">
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-4 sm:p-5 pb-3 sm:pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-950"><Activity className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />Tren Penjualan</CardTitle>
              <CardDescription className="mt-0.5 text-[11px] sm:text-xs">Perbandingan omzet dan profit</CardDescription>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-indigo-600" />Omzet</span><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Profit</span></div>
          </CardHeader>
          <CardContent className="px-1 sm:px-4 pb-3 pt-4"><SalesTrendChart data={data.dailyData} isMasked={isMasked} /></CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-4 sm:p-5 pb-3 sm:pb-4">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base font-bold text-slate-950"><span className="flex items-center gap-2"><Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />Transaksi Terbaru</span><Badge variant="outline">{isMasked ? "••" : metrics.recentTransactions.length}</Badge></CardTitle>
            <CardDescription className="mt-0.5 text-[11px] sm:text-xs">Aktivitas terbaru pada periode terpilih</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.recentTransactions.length === 0 ? (
              <div className="grid min-h-56 sm:min-h-64 place-items-center p-6 text-center"><div><Receipt className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Belum ada transaksi</p><p className="mt-1 text-xs text-slate-400">Coba pilih periode yang lebih panjang.</p></div></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {metrics.recentTransactions.map((transaction) => (
                  <Link
                    key={transaction.id}
                    href={`/dashboard/transactions?edit=${encodeURIComponent(transaction.transaction_id || transaction.id)}`}
                    className="group flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 transition-all hover:bg-indigo-50/60 active:scale-[0.99]"
                    title="Klik untuk membuka dan mengubah status transaksi"
                  >
                    <span className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs sm:text-sm font-black text-slate-700 transition group-hover:bg-indigo-600 group-hover:text-white">
                      {transaction.customer_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs sm:text-sm font-bold text-slate-900 transition group-hover:text-indigo-600">
                          {transaction.customer_name}
                        </p>
                        <span className="font-mono text-[9px] sm:text-[10px] text-slate-400 shrink-0">
                          {transaction.transaction_id ?? transaction.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="truncate text-[11px] sm:text-xs text-slate-500">
                        {transaction.product_name} • {transaction.duration}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-xs sm:text-sm font-bold text-slate-900 transition-all duration-200", isMasked && "font-mono tracking-wider text-slate-700")}>
                        {isMasked ? "Rp ••••••••" : formatIDR(transaction.price)}
                      </p>
                      <StatusBadge value={transaction.status} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
          {metrics.recentTransactions.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/80 p-2.5 sm:p-3 text-center">
              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                <span>Buka semua transaksi & ubah status</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function StatusBadge({ value }: { value: "pending" | "success" | "cancelled" }) {
  if (value === "success") return <span className="text-[11px] font-bold text-emerald-600">Berhasil</span>;
  if (value === "pending") return <span className="text-[11px] font-bold text-amber-600">Menunggu</span>;
  return <span className="text-[11px] font-bold text-rose-600">Gagal</span>;
}
