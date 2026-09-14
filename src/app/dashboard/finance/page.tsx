"use client";

import React, { useEffect, useState, useMemo } from "react";
import { financeService, FinancialData, PeriodFilter } from "@/services/financeService";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { useSettings } from "@/hooks/useSettings";
import { formatIDR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Percent, Receipt, Calendar, Package, Users, Activity, Crown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from "recharts";

export default function FinanceDashboardPage() {
  const { settings, isLoaded } = useSettings();
  const [data, setData] = useState<FinancialData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<PeriodFilter>("7days");

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await financeService.getFinancialOverview(period);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    loadData();

    if (settings.realtimeOn) {
      const channel = transactionRealtimeService.subscribeTransactions((payload) => {
        // Only trigger loadData when we have a successful transaction insert or update
        // (to optimize we could update state locally, but delayed reload ensures exact calculations)
        const isSuccessInsert = payload.eventType === "INSERT" && payload.new.status === "success";
        const isSuccessUpdate = payload.eventType === "UPDATE" && payload.new.status === "success";
        
        if (isSuccessInsert || isSuccessUpdate) {
          setTimeout(() => loadData(), 1000);
        }
      });
      return () => {
        try {
          if (channel) transactionRealtimeService.unsubscribe(channel);
        } catch {}
      };
    }
  }, [isLoaded, period, settings.realtimeOn]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-slate-100" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 bg-slate-100" />
          <Skeleton className="h-10 w-24 bg-slate-100" />
          <Skeleton className="h-10 w-24 bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full bg-slate-100" />
          <Skeleton className="h-28 w-full bg-slate-100" />
          <Skeleton className="h-28 w-full bg-slate-100" />
          <Skeleton className="h-28 w-full bg-slate-100" />
        </div>
        <Skeleton className="h-96 w-full bg-slate-100" />
      </div>
    );
  }

  const { metrics, dailyTrend, productProfits, customerValues } = data;

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xl">
          <p className="text-slate-800 font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-bold text-slate-900">
                {entry.name.includes("Transaction") 
                  ? entry.value 
                  : formatIDR(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-emerald-400" /> Financial Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Analisis komprehensif performa keuangan dan metrik profitabilitas bisnis Anda.
        </p>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {(["today", "7days", "month"] as PeriodFilter[]).map((p) => {
          const labels = { today: "Hari Ini", "7days": "7 Hari Terakhir", month: "Bulan Ini" };
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                period === p 
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/20" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {labels[p as keyof typeof labels]}
            </button>
          );
        })}
      </div>

      {/* 1. FINANCIAL SUMMARY CARD */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-4">
        <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Revenue</p>
                <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-slate-950 mt-1 truncate" title={formatIDR(metrics.totalRevenue)}>{formatIDR(metrics.totalRevenue)}</h3>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Profit</p>
                <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-indigo-600 mt-1 truncate" title={formatIDR(metrics.totalProfit)}>{formatIDR(metrics.totalProfit)}</h3>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Profit Margin</p>
                <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-amber-600 mt-1 truncate">{metrics.profitMargin.toFixed(1)}%</h3>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Transactions</p>
                <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-slate-950 mt-1 truncate">{metrics.totalTransactions}</h3>
              </div>
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. FINANCIAL INSIGHT CARD */}
      <div className="grid gap-3 sm:gap-5 sm:grid-cols-3">
        <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
          <CardContent className="p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Calendar className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Best Revenue Day</p>
              <p className="text-sm font-bold text-slate-950 truncate">{metrics.bestRevenueDay}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <Package className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Best Profit Product</p>
              <p className="text-sm font-bold text-slate-950 truncate">{metrics.bestProfitProduct}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Average Transaction Value</p>
              <p className="text-sm font-bold text-slate-950">{formatIDR(metrics.averageTransactionValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. FINANCIAL CHART */}
      <Card className="border-slate-200 bg-white backdrop-blur-xl">
        <CardHeader className="border-b border-slate-200 pb-4">
          <CardTitle className="text-base font-bold text-slate-950">Revenue & Profit Trend</CardTitle>
          <CardDescription className="text-slate-400">Pergerakan pendapatan dan keuntungan harian.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp${val / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 4. PROFIT ANALYSIS (Product) */}
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-4 sm:p-5 pb-3 sm:pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" /> Profit by Product
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">Top 5 produk dengan kontribusi profit tertinggi</CardDescription>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 shrink-0">
              Top 5
            </span>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[540px]">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-10 text-center">#</th>
                  <th className="py-3 px-3">Produk</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Terjual</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Revenue</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Profit</th>
                  <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {productProfits.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 pr-2 text-center text-[11px] font-bold text-slate-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 truncate max-w-[170px] sm:max-w-[210px]" title={p.productName}>
                        {p.productName}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {p.soldCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-slate-600">
                      {formatIDR(p.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-indigo-600">
                      {formatIDR(p.profit)}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {productProfits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                      Tidak ada data produk pada periode ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 5. CUSTOMER VALUE ANALYSIS */}
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-4 sm:p-5 pb-3 sm:pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2">
                <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" /> Top Customer by Spending
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">Pelanggan dengan total belanja tertinggi</CardDescription>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
              Top 5
            </span>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[480px]">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-10 text-center">#</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Total Order</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Total Spending</th>
                  <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Total Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customerValues.slice(0, 5).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 pr-2 text-center text-[11px] font-bold text-slate-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 truncate max-w-[160px] sm:max-w-[200px]" title={c.customerName}>
                        {c.customerName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {c.customerPhone}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {c.totalOrder} order
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-emerald-600">
                      {formatIDR(c.totalSpending)}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap font-bold text-indigo-600">
                      {formatIDR(c.totalProfit)}
                    </td>
                  </tr>
                ))}
                {customerValues.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                      Tidak ada data customer pada periode ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
