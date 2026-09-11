"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { productMasterService, ProductMasterRow } from "@/services/productMasterService";
import { productService } from "@/services/productService";
import { formatIDR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowLeft, Receipt, DollarSign, Users, TrendingUp } from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  const [product, setProduct] = useState<ProductMasterRow | null>(null);
  const [analytics, setAnalytics] = useState({
    totalSold: 0,
    totalRevenue: 0,
    totalProfit: 0,
    customerCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const id = params?.id as string;
        if (!id) return;
        
        const prod = await productMasterService.getProductById(id);
        if (!prod) {
          router.push("/dashboard/products");
          return;
        }
        
        setProduct(prod);
        
        const stats = await productService.getProductAnalyticsByName(prod.name);
        setAnalytics(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    load();
  }, [params?.id, router]);

  if (isLoading || !product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 bg-slate-100 rounded-lg" />
          <Skeleton className="h-8 w-64 bg-slate-100" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full bg-slate-100" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full bg-slate-100" />
            <Skeleton className="h-32 w-full bg-slate-100" />
            <Skeleton className="h-32 w-full bg-slate-100" />
            <Skeleton className="h-32 w-full bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push("/dashboard/products")}
          className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 flex items-center gap-3">
            <Package className="h-6 w-6 text-indigo-400" /> Detail Produk
          </h1>
          <p className="text-xs text-slate-400 pt-1">
            Informasi master data produk dan analitik penjualan
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Master Info */}
        <div className="lg:col-span-4">
          <Card className="border-slate-200 bg-white backdrop-blur-xl h-full">
            <CardHeader className="border-b border-slate-200 pb-4">
              <CardTitle className="text-base font-bold text-slate-950">Product Master</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nama Produk</p>
                <p className="text-lg font-bold text-slate-950">{product.name}</p>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Kategori</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {product.category || 'Uncategorized'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Harga Dasar</p>
                  <p className="text-sm font-bold text-slate-800">{formatIDR(product.price)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Profit</p>
                  <p className="text-sm font-bold text-emerald-400">{formatIDR(product.profit_amount)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                {product.status === 'ACTIVE' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-500/10 text-slate-400 text-xs font-bold border border-slate-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> INACTIVE
                  </span>
                )}
              </div>
              
              {product.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deskripsi</p>
                  <p className="text-sm text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {product.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analytics */}
        <div className="lg:col-span-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Terjual (Berhasil)</p>
                    <h3 className="text-3xl font-bold text-slate-950 mt-2">{analytics.totalSold} <span className="text-sm font-normal text-slate-500">trx</span></h3>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Receipt className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Customer Unik</p>
                    <h3 className="text-3xl font-bold text-slate-950 mt-2">{analytics.customerCount} <span className="text-sm font-normal text-slate-500">orang</span></h3>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Revenue</p>
                    <h3 className="text-2xl font-bold text-indigo-400 mt-2">{formatIDR(analytics.totalRevenue)}</h3>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Profit Kontribusi</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-2">{formatIDR(analytics.totalProfit)}</h3>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
            <Package className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-indigo-300">Matching Analytics</h4>
              <p className="text-xs text-indigo-200/70 mt-1">
                Seluruh perhitungan analitik di atas menggunakan string matching <b>"{product.name}"</b> pada histori tabel transactions untuk memastikan riwayat pesanan lama sebelum adanya sistem Product Master tetap terbaca dengan akurat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
