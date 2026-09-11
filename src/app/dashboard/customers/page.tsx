"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { customerService } from "@/services/customerService";
import { CustomerWithAnalytics } from "@/types";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { customerRealtimeService } from "@/services/customerRealtimeService";
import { LoyaltyManager } from "@/components/customers/loyalty-manager";
import { authService } from "@/services/authService";
import { useSettings } from "@/hooks/useSettings";
import { formatIDR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Phone,
  User,
  ShoppingBag,
  Calendar,
  Star,
  TrendingUp,
  Wallet,
  Activity,
  Coins,
  Trash2
} from "lucide-react";

export default function CustomersPage() {
  const { settings, isLoaded } = useSettings();
  const [customers, setCustomers] = useState<CustomerWithAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Filter & Pagination state
  const [search, setSearch] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customerService.getCustomersWithAnalytics();
      setCustomers(data || []);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Gagal memuat data customer";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    authService.getUserRole().then((role) => setCanEdit(role === "OWNER" || role === "ADMIN"));
    
    fetchCustomers();

    if (settings.realtimeOn) {
      const transactionChannel = transactionRealtimeService.subscribeTransactions(() => {
        // Debounce sedikit agar database terupdate
        setTimeout(() => {
          fetchCustomers();
        }, 1000);
      });
      const customerChannel = customerRealtimeService.subscribe(() => {
        setTimeout(() => fetchCustomers(), 350);
      });

      return () => {
        try {
          if (transactionChannel) transactionRealtimeService.unsubscribe(transactionChannel);
          if (customerChannel) customerRealtimeService.unsubscribe(customerChannel);
        } catch {}
      };
    }
  }, [fetchCustomers, isLoaded, settings.realtimeOn]);

  const removeCustomer = async (phone: string, name: string) => {
    if (!confirm(`Hapus customer ${name}? Riwayat transaksi tidak ikut terhapus.`)) return;
    try { await customerService.deleteCustomer(phone); await fetchCustomers(); }
    catch (err) { setError(err instanceof Error ? err.message : "Gagal menghapus customer"); }
  };

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = customers;
    
    if (segmentFilter !== "ALL") {
      result = result.filter(c => c.segment === segmentFilter);
    }
    
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.customer_name?.toLowerCase().includes(term) ||
          c.customer_phone?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [customers, search, segmentFilter]);

  // Pagination
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginatedCustomers = useMemo(() => {
    const from = (page - 1) * limit;
    return filtered.slice(from, from + limit);
  }, [filtered, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [search, segmentFilter]);

  const getSegmentBadge = (segment?: string) => {
    switch (segment) {
      case "VIP": return <Badge className="bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20">VIP</Badge>;
      case "ACTIVE": return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ACTIVE</Badge>;
      case "NEW": return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">NEW</Badge>;
      default: return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">INACTIVE</Badge>;
    }
  };

  const getScoreColor = (score?: number) => {
    const s = score || 0;
    if (s >= 80) return "text-fuchsia-400";
    if (s >= 50) return "text-emerald-400";
    if (s >= 20) return "text-blue-400";
    return "text-slate-400";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-400" /> Smart CRM Customer Intelligence
          </h1>
          <p className="text-xs text-slate-400 pt-1">
            Segmentasi, scoring, dan analitik pelanggan otomatis secara realtime.
          </p>
        </div>

        <Button
          onClick={fetchCustomers}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="border-slate-300 bg-white text-xs text-slate-800 hover:bg-slate-100"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Segarkan Data
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Card className="border-slate-200 bg-white backdrop-blur-xl h-full">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
              <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Cari nama, nomor WhatsApp..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-800 focus:border-indigo-500"
                  />
                </div>
              </form>
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {['ALL', 'VIP', 'ACTIVE', 'NEW', 'INACTIVE'].map(seg => (
                  <button
                    key={seg}
                    onClick={() => setSegmentFilter(seg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      segmentFilter === seg 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                        : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-4">
           <Card className="border-slate-200 bg-white backdrop-blur-xl h-full">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Activity className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Database</p>
                <h3 className="text-xl font-bold text-slate-950">{customers.length} <span className="text-xs font-normal text-slate-500">Customer</span></h3>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div className="flex items-center gap-3 text-red-300">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
              <div>
                <h4 className="font-semibold text-sm text-red-200">Gagal Memuat Pelanggan</h4>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
            </div>
            <Button
              onClick={fetchCustomers}
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white font-medium shrink-0"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SKELETON LOADING STATE */}
      {isLoading && customers.length === 0 && !error && (
        <Card className="border-slate-200 bg-white p-6 space-y-4">
          <Skeleton className="h-8 w-full bg-slate-100" />
          <Skeleton className="h-12 w-full bg-slate-100" />
          <Skeleton className="h-12 w-full bg-slate-100" />
          <Skeleton className="h-12 w-full bg-slate-100" />
        </Card>
      )}

      {/* SUCCESS STATE & TABLE */}
      {!isLoading && !error && (
        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 pb-4">
            <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
              Daftar Customer Intelligence
              <span className="text-xs font-normal text-slate-400">
                (Menampilkan {totalCount} data)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {paginatedCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Inbox className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-950">Tidak Ada Customer Ditemukan</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Cobalah mengubah filter segmen atau kata kunci pencarian.
                </p>
              </div>
            ) : (
              <>
              <div className="space-y-3 p-3 md:hidden">
                {paginatedCustomers.map((cust) => (
                  <article key={cust.customer_phone} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-slate-950">{cust.customer_name}</h3>{getSegmentBadge(cust.segment)}</div><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5 text-emerald-500" />{cust.customer_phone.replace("@lid", "")}</p></div>{settings.customerScoreEnabled && <div className="rounded-xl bg-indigo-50 px-3 py-2 text-center"><p className="text-[10px] font-bold text-indigo-500">SCORE</p><p className={`text-lg font-black ${getScoreColor(cust.score)}`}>{cust.score}</p></div>}</div>
                    <div className={`mt-4 grid gap-2 ${settings.customerPointsEnabled ? "grid-cols-3" : "grid-cols-2"}`}><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-semibold text-slate-400">ORDER</p><p className="mt-1 text-sm font-black text-slate-900">{cust.totalTransactions}</p></div><div className="rounded-xl bg-emerald-50 p-2.5"><p className="text-[10px] font-semibold text-emerald-600">PROFIT</p><p className="mt-1 truncate text-xs font-black text-emerald-700">{formatIDR(cust.totalProfit)}</p></div>{settings.customerPointsEnabled && <div className="rounded-xl bg-amber-50 p-2.5"><p className="text-[10px] font-semibold text-amber-600">POIN</p><p className="mt-1 text-sm font-black text-amber-800">{cust.loyalty_points}</p></div>}</div>
                    {settings.customerPointsEnabled && cust.discount_balance > 0 && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Saldo diskon: {formatIDR(cust.discount_balance)}</p>}
                    <div className={`mt-4 grid gap-2 ${canEdit && settings.customerPointsEnabled ? "grid-cols-2" : "grid-cols-1"}`}><Link href={`/dashboard/customers/${encodeURIComponent(cust.customer_phone)}`}><Button variant="outline" className="h-10 w-full">Profil</Button></Link>{canEdit && settings.customerPointsEnabled && <LoyaltyManager customer={cust} onUpdated={fetchCustomers} />}</div>
                  </article>
                ))}
              </div>
              <table className="hidden w-full text-left text-xs md:table">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Customer & Segmen</th>
                    {settings.customerScoreEnabled && <th className="px-6 py-3.5">Score</th>}
                    <th className="px-6 py-3.5">Order</th>
                    {settings.customerPointsEnabled && <th className="px-6 py-3.5">Poin Reward</th>}
                    <th className="px-6 py-3.5">Total Profit</th>
                    <th className="px-6 py-3.5">Insight Utama</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedCustomers.map((cust) => (
                    <tr key={cust.customer_phone} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{cust.customer_name}</span>
                            {getSegmentBadge(cust.segment)}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                            <Phone className="h-3 w-3 text-emerald-400" />
                            <span>{cust.customer_phone}</span>
                          </div>
                        </div>
                      </td>

                      {settings.customerScoreEnabled && <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`text-lg font-black ${getScoreColor(cust.score)}`}>
                            {cust.score}
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold mt-1">/ 100</span>
                        </div>
                      </td>}

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium text-slate-800">
                            {cust.totalTransactions} Trx
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {cust.purchaseFrequency}
                          </div>
                        </div>
                      </td>

                      {settings.customerPointsEnabled && <td className="px-6 py-4">
                        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600"><Coins className="h-4 w-4" /></span><div><p className="font-black text-slate-900">{cust.loyalty_points} poin</p><p className="text-[10px] text-slate-400">Diskon {formatIDR(cust.discount_balance)}</p></div></div>
                      </td>}

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="font-bold text-emerald-400">
                            {formatIDR(cust.totalProfit)}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            Spent: {formatIDR(cust.totalSpending)}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {cust.favoriteProduct ? (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-200">
                              <Star className="h-3 w-3 text-amber-400" />
                              <span className="truncate max-w-[120px]">{cust.favoriteProduct}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">-</span>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {cust.lastPurchase ? new Date(cust.lastPurchase).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2"><Link href={`/dashboard/customers/${encodeURIComponent(cust.customer_phone)}`}><Button variant="outline" size="sm" className="h-9 border-slate-300 bg-white hover:bg-slate-100 text-xs text-slate-700">Profil</Button></Link>
                        {canEdit && settings.customerPointsEnabled && <LoyaltyManager customer={cust} onUpdated={fetchCustomers} />}
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeCustomer(cust.customer_phone, cust.customer_name)} aria-label="Hapus customer"><Trash2 className="h-4 w-4" /></Button>}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </CardContent>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs text-slate-400">
              <div>
                Halaman <span className="font-bold text-slate-800">{page}</span> dari <span className="font-bold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 bg-slate-50 hover:text-slate-950"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 bg-slate-50 hover:text-slate-950"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
