"use client";

import React, { useEffect, useState } from "react";
import { reportService, PeriodFilter, ReportData, DateRange } from "@/services/reportService";
import { formatIDR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  PieChart as PieChartIcon,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Calendar,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Users,
  RefreshCw,
  Trophy,
  Package
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>("7days");
  const [customRange, setCustomRange] = useState<DateRange>({ startDate: "", endDate: "" });
  const [showCustom, setShowCustom] = useState<boolean>(false);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportService.getReportData(period, customRange);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal memuat laporan");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (period !== "custom") {
      fetchReport();
    }
  }, [period]);

  const handleCustomApply = () => {
    if (customRange.startDate && customRange.endDate) {
      fetchReport();
    }
  };

  const handleExportCSV = (isExcel = false) => {
    if (!data) return;

    let csv = "REPORT SUMMARY\n";
    csv += `Total Revenue,Total Profit,Total Transactions,New Customers\n`;
    csv += `${data.summary.totalRevenue},${data.summary.totalProfit},${data.summary.totalTransaction},${data.summary.newCustomerCount}\n\n`;

    csv += "TOP CUSTOMERS\n";
    csv += "Rank,Name,Phone,Total Orders,Total Spending,Total Profit\n";
    data.topCustomers.forEach((c, i) => {
      csv += `${i+1},${c.customer_name},${c.customer_phone},${c.totalTransactions},${c.totalSpending},${c.totalProfit}\n`;
    });

    csv += "\nTOP PRODUCTS\n";
    csv += "Rank,Product,Total Orders,Total Revenue,Total Profit\n";
    data.topProducts.forEach((p, i) => {
      csv += `${i+1},${p.product_name},${p.totalTransactions},${p.totalRevenue},${p.totalProfit}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Candra_Report_${data.period}${isExcel ? '.csv' : '.csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold text-slate-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 my-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-bold text-slate-900">
                {entry.name.toLowerCase().includes("revenue") || entry.name.toLowerCase().includes("profit") 
                  ? formatIDR(entry.value) 
                  : entry.value}
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
      {/* CSS untuk memanipulasi Print Preview (PDF) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          aside, header, .print-hide { display: none !important; }
          body, main { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .bg-white\\/60, .bg-slate-50, .bg-white { background: white !important; border: 1px solid #ccc !important; }
          .text-slate-950, .text-slate-800, .text-slate-700, .text-slate-400 { color: black !important; }
          .border-slate-200\\/80, .border-slate-200 { border-color: #eee !important; }
          canvas, svg { max-width: 100% !important; }
        }
      `}} />

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl flex items-center gap-3">
            <PieChartIcon className="h-7 w-7 text-indigo-400" /> Reporting & Analytics
          </h1>
          <p className="text-xs text-slate-400 pt-1">
            Pantau performa bisnis, analisis pendapatan, dan unduh laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print-hide">
          <Button onClick={() => handleExportCSV(false)} variant="outline" size="sm" className="bg-white border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100">
            <FileText className="mr-2 h-4 w-4 text-blue-400" /> CSV
          </Button>
          <Button onClick={() => handleExportCSV(true)} variant="outline" size="sm" className="bg-white border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-400" /> Excel
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="bg-white border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100">
            <Printer className="mr-2 h-4 w-4 text-rose-400" /> PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white backdrop-blur-xl print-hide">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {[
              { id: "today", label: "Hari Ini" },
              { id: "7days", label: "7 Hari Terakhir" },
              { id: "month", label: "Bulan Ini" },
              { id: "custom", label: "Custom Range" }
            ].map((p) => (
              <Button
                key={p.id}
                variant={period === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriod(p.id as PeriodFilter);
                  setShowCustom(p.id === "custom");
                }}
                className={period === p.id 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" 
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {showCustom && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input 
                type="date" 
                value={customRange.startDate}
                onChange={(e) => setCustomRange(prev => ({...prev, startDate: e.target.value}))}
                className="bg-slate-50 border-slate-200 text-xs text-slate-800 h-9" 
              />
              <span className="text-slate-500">-</span>
              <Input 
                type="date" 
                value={customRange.endDate}
                onChange={(e) => setCustomRange(prev => ({...prev, endDate: e.target.value}))}
                className="bg-slate-50 border-slate-200 text-xs text-slate-800 h-9" 
              />
              <Button onClick={handleCustomApply} size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-9">
                Apply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <div className="col-span-full"><Skeleton className="h-96 w-full" /></div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <Button onClick={fetchReport} variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/20">
            <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
          </Button>
        </div>
      )}

      {/* Data View */}
      {!isLoading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
              <CardContent className="p-3.5 sm:p-6">
                <div className="flex justify-between items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Revenue</p>
                    <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-slate-950 mt-1 truncate" title={formatIDR(data.summary.totalRevenue)}>{formatIDR(data.summary.totalRevenue)}</h3>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
              <CardContent className="p-3.5 sm:p-6">
                <div className="flex justify-between items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Profit</p>
                    <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-emerald-600 mt-1 truncate" title={formatIDR(data.summary.totalProfit)}>{formatIDR(data.summary.totalProfit)}</h3>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
              <CardContent className="p-3.5 sm:p-6">
                <div className="flex justify-between items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">Total Transaction</p>
                    <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-slate-950 mt-1 truncate">{data.summary.totalTransaction} <span className="text-[11px] sm:text-sm font-normal text-slate-500">sukses</span></h3>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl shadow-xs">
              <CardContent className="p-3.5 sm:p-6">
                <div className="flex justify-between items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-sm font-medium text-slate-400 truncate">New Customer</p>
                    <h3 className="text-base min-[380px]:text-lg sm:text-2xl font-bold text-pink-600 mt-1 truncate">+{data.summary.newCustomerCount}</h3>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-lg bg-pink-500/10 text-pink-600 border border-pink-500/20 shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardHeader className="pb-2 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Revenue & Profit Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData} margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `Rp${value/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardHeader className="pb-2 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-400" /> Transaction Volume
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e293b'}} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                    <Bar dataKey="transactions" name="Transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboards */}
          <div className="grid gap-5 lg:grid-cols-2 mt-5">
            {/* Top Customers */}
            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardHeader className="pb-3 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-400" /> Top Customers
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Peringkat pelanggan berdasarkan total belanja
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Spending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.topCustomers.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">Tidak ada data</td></tr>
                    ) : data.topCustomers.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{c.customer_name}</div>
                          <div className="text-[10px] text-slate-500">{c.customer_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{c.totalTransactions}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-300">{formatIDR(c.totalSpending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardHeader className="pb-3 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Package className="h-5 w-5 text-pink-400" /> Top Products
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Produk paling laris berdasarkan revenue
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Produk</th>
                      <th className="px-4 py-3 text-right">Terjual</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.topProducts.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">Tidak ada data</td></tr>
                    ) : data.topProducts.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.product_name}</td>
                        <td className="px-4 py-3 text-right font-medium">{p.totalTransactions}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-300">{formatIDR(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
