"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { BotInstanceRow, TransactionRow } from "@/types";
import { formatIDR } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Bot, CheckCircle2, Clock, MessageSquare, Terminal, Wifi, WifiOff } from "lucide-react";

type RealtimeState = "connecting" | "connected" | "disconnected";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function isAlive(bot: BotInstanceRow | null, currentTime: number) {
  return Boolean(bot && bot.status === "online" && currentTime - new Date(bot.last_seen).getTime() < 90_000);
}

export default function BotMonitoringPage() {
  const [bot, setBot] = useState<BotInstanceRow | null>(null);
  const [now, setNow] = useState(0);
  const [realtime, setRealtime] = useState<RealtimeState>("connecting");
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [botResult, transactionResult] = await Promise.all([
      supabase.from("bot_instances").select("*").order("last_seen", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("transactions").select("*").gte("created_at", startOfToday()).order("created_at", { ascending: false }).limit(100),
    ]);
    if (botResult.error) setLoadError(`Status bot: ${botResult.error.message}`);
    else setBot(botResult.data);
    if (transactionResult.error) setLoadError(`Transaksi: ${transactionResult.error.message}`);
    else setTransactions(transactionResult.data ?? []);
  }, []);

  useEffect(() => {
    void load();
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    const channel = supabase
      .channel("dashboard-monitoring")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_instances" }, (payload) => {
        if (payload.eventType === "DELETE") setBot(null);
        else setBot(payload.new as BotInstanceRow);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtime("connected");
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) setRealtime("disconnected");
      });
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const summary = useMemo(() => {
    const successful = transactions.filter((item) => item.status === "success");
    return {
      pending: transactions.filter((item) => item.status === "pending").length,
      successful: successful.length,
      revenue: successful.reduce((total, item) => total + Number(item.price || 0), 0),
    };
  }, [transactions]);

  const online = isAlive(bot, now);
  const heartbeatAge = bot ? Math.max(0, Math.round((now - new Date(bot.last_seen).getTime()) / 1000)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-950"><Terminal className="h-6 w-6 text-indigo-500" /> Monitoring Bot Real-time</h1>
        <p className="mt-1 text-sm text-slate-500">Heartbeat bot dan transaksi hari ini langsung dari Supabase.</p>
      </div>

      {loadError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {loadError}. Jalankan ulang supabase/schema.sql bila tabel belum tersedia.</div>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatusCard label="WhatsApp Bot" value={online ? "ONLINE" : "OFFLINE"} icon={<Bot className="h-5 w-5" />} tone={online ? "green" : "red"} />
        <StatusCard label="Supabase Realtime" value={realtime.toUpperCase()} icon={realtime === "connected" ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />} tone={realtime === "connected" ? "indigo" : "red"} />
        <StatusCard label="Transaksi Hari Ini" value={String(transactions.length)} icon={<MessageSquare className="h-5 w-5" />} tone="blue" />
        <StatusCard label="Pending" value={String(summary.pending)} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatusCard label="Berhasil" value={String(summary.successful)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatusCard label="Omzet Hari Ini" value={formatIDR(summary.revenue)} icon={<Activity className="h-5 w-5" />} tone="indigo" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-500" /> Aktivitas Transaksi</CardTitle><CardDescription>100 transaksi terbaru hari ini. Daftar diperbarui saat bot atau dashboard melakukan CRUD.</CardDescription></CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto">
            {transactions.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Belum ada transaksi hari ini.</p> : (
              <div className="divide-y divide-slate-100">{transactions.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold text-slate-900">{item.customer_name} · {item.product_name}</p><p className="text-xs text-slate-500">{item.customer_phone} · {new Date(item.created_at).toLocaleString("id-ID")}</p></div>
                  <div className="flex items-center gap-3 sm:text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "success" ? "bg-emerald-50 text-emerald-700" : item.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status.toUpperCase()}</span><span className="min-w-24 font-semibold text-slate-900">{formatIDR(Number(item.price || 0))}</span></div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-indigo-500" /> Detail Instance</CardTitle><CardDescription>Data dikirim otomatis oleh proses bot setiap 30 detik.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Detail label="Nama" value={bot?.name ?? "Belum terdaftar"} /><Detail label="Instance ID" value={bot?.id ?? "-"} /><Detail label="Versi integrasi" value={bot?.version ?? "-"} /><Detail label="Status terakhir" value={bot?.status?.toUpperCase() ?? "-"} /><Detail label="Heartbeat" value={heartbeatAge === null ? "Belum ada" : `${heartbeatAge} detik lalu`} /><Detail label="Terakhir aktif" value={bot ? new Date(bot.last_seen).toLocaleString("id-ID") : "-"} />
            <div className={`mt-4 rounded-xl border p-4 ${online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{online ? "Bot tersambung dan mengirim heartbeat normal." : "Bot tidak mengirim heartbeat dalam 90 detik. Periksa proses bot, internet, dan variabel Supabase di Pterodactyl."}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3"><span className="text-slate-500">{label}</span><span className="break-all text-right font-medium text-slate-900">{value}</span></div>;
}

function StatusCard({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: "green" | "red" | "indigo" | "blue" | "amber" }) {
  const colors = { green: "bg-emerald-50 text-emerald-600", red: "bg-red-50 text-red-600", indigo: "bg-indigo-50 text-indigo-600", blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600" };
  return <Card className="border-slate-200"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-950">{value}</p></div><div className={`rounded-lg p-2 ${colors[tone]}`}>{icon}</div></CardContent></Card>;
}
