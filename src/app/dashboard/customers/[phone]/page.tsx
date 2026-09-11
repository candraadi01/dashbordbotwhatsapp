"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { customerService } from "@/services/customerService";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { CustomerDetail } from "@/types";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  User,
  Phone,
  Calendar,
  Clock,
  ShoppingBag,
  Wallet,
  TrendingUp,
  Star,
  Receipt,
  AlertTriangle,
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { settings, isLoaded } = useSettings();
  const rawPhone = Array.isArray(params?.phone) ? params.phone[0] : params?.phone;
  const phone = rawPhone ? decodeURIComponent(rawPhone) : "";

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;

    const loadData = async () => {
      try {
        const data = await customerService.getCustomerDetail(phone);
        if (!data) throw new Error("Customer tidak ditemukan");
        setDetail(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Gagal memuat detail pelanggan");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    if (isLoaded && settings.realtimeOn) {
      const channel = transactionRealtimeService.subscribeTransactions((payload) => {
        const data = payload.new as any;
        if (data && data.customer_phone === phone) {
          loadData(); // Refetch if this customer has a new or updated transaction
        }
      });

      return () => {
        try {
          if (channel) transactionRealtimeService.unsubscribe(channel);
        } catch {}
      };
    }
  }, [phone, isLoaded, settings.realtimeOn]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-8" />
        <Card className="border-slate-200 bg-white p-6 space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-4 sm:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full mt-6" />
        </Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <Button 
          variant="outline" 
          onClick={() => router.push("/dashboard/customers")}
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-200">Customer Tidak Ditemukan</h3>
              <p className="text-sm text-red-300/80 mt-1">{error || "Data untuk nomor ini tidak tersedia"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button 
        variant="outline" 
        onClick={() => router.push("/dashboard/customers")}
        className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950"
      >
        <ChevronLeft className="mr-2 h-4 w-4" /> Kembali ke Customers
      </Button>

      {/* Profile Header */}
      <Card className="border-slate-200 bg-white backdrop-blur-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-950/50 shadow-inner text-3xl font-bold text-slate-400">
                {detail.customer.name ? detail.customer.name.substring(0, 2).toUpperCase() : "?"}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
                  {detail.customer.name}
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-2">
                  <div className="flex items-center text-slate-400 text-sm">
                    <Phone className="h-4 w-4 mr-1.5 text-emerald-400" />
                    {detail.customer.phone}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 bg-slate-50/40 p-4 rounded-xl border border-slate-200/50 min-w-[240px]">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> First Order</span>
                <span className="text-slate-800 font-medium">
                  {new Date(detail.customer.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Last Active</span>
                <span className="text-slate-800 font-medium">
                  {detail.summary.lastPurchase 
                    ? new Date(detail.summary.lastPurchase).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Order</p>
                <h3 className="text-2xl font-bold text-slate-950 mt-1">{detail.summary.totalTransactions}</h3>
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Spending</p>
                <h3 className="text-2xl font-bold text-slate-950 mt-1">{formatIDR(detail.summary.totalSpending)}</h3>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Profit</p>
                <h3 className="text-2xl font-bold text-slate-950 mt-1">{formatIDR(detail.summary.totalProfit)}</h3>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Favorite Product</p>
                <h3 className="text-lg font-bold text-slate-950 mt-1 truncate max-w-[150px]" title={detail.summary.favoriteProduct || "-"}>
                  {detail.summary.favoriteProduct || "-"}
                </h3>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Table */}
      <Card className="border-slate-200 bg-white backdrop-blur-xl">
        <CardHeader className="pb-3 border-b border-slate-200">
          <CardTitle className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-400" /> Histori Transaksi
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Seluruh riwayat pemesanan dari pelanggan ini
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {detail.transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada data transaksi
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">Produk</th>
                  <th className="px-6 py-3.5">Harga</th>
                  <th className="px-6 py-3.5">Profit</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {detail.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{tx.product_name}</td>
                    <td className="px-6 py-4 font-bold text-indigo-300">{formatIDR(tx.price)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-300">
                      {tx.profit_amount ? formatIDR(tx.profit_amount) : "-"}
                    </td>
                    <td className="px-6 py-4">
                      {tx.status === "success" && <Badge variant="success">Success</Badge>}
                      {tx.status === "pending" && <Badge variant="warning">Pending</Badge>}
                      {tx.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
