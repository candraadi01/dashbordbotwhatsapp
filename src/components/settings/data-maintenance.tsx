"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Database, Loader2, ShieldAlert, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dashboardMaintenanceService, PurgeTarget } from "@/services/dashboardMaintenanceService";

const options: Array<{ target: PurgeTarget; title: string; description: string; icon: typeof Trash2 }> = [
  { target: "transactions", title: "Hapus seluruh transaksi", description: "Transaksi dan log dihapus, tetapi customer serta produk tetap disimpan.", icon: Trash2 },
  { target: "customers", title: "Hapus seluruh customer", description: "Data customer dan poin dihapus, sedangkan transaksi serta produk tetap ada.", icon: Users },
  { target: "sales_data", title: "Bersihkan data penjualan", description: "Transaksi, log, dan customer dihapus. Katalog produk tetap aman.", icon: Database },
];

export function DataMaintenance({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PurgeTarget | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = options.find((option) => option.target === target);

  function close() {
    if (busy) return;
    resetAndClose();
  }

  function resetAndClose() {
    setOpen(false);
    setTarget(null);
    setConfirmation("");
    setError("");
  }

  async function purge() {
    if (!target || confirmation !== "HAPUS") return;
    setBusy(true);
    setError("");
    try {
      const result = await dashboardMaintenanceService.purge(target);
      const total = result.deleted_transactions + result.deleted_customers;
      setMessage(`${total.toLocaleString("id-ID")} data berhasil dibersihkan. Produk tetap aman.`);
      setBusy(false);
      resetAndClose();
      onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal dibersihkan.");
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="overflow-hidden border-rose-200 bg-white shadow-sm md:col-span-2">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert className="h-5 w-5" /></span>
              <div><h2 className="text-base font-bold text-slate-950">Pusat Pembersihan Data</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">Fitur khusus OWNER untuk membersihkan transaksi atau customer. Katalog produk tidak akan terhapus.</p></div>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)} className="h-11 border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="mr-2 h-4 w-4" />Kelola data</Button>
          </div>
          {message && <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-700">{message}</div>}
        </CardContent>
      </Card>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
            <motion.div role="dialog" aria-modal="true" aria-label="Pusat pembersihan data" initial={{ y: 80, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 80, opacity: 0, scale: 0.98 }} transition={{ type: "spring", damping: 26, stiffness: 320 }} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
                <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-600"><ShieldAlert className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Pembersihan database</h2><p className="text-xs text-slate-500">Pilih data yang ingin dibersihkan</p></div></div>
                <button type="button" disabled={busy} onClick={close} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-40"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3 p-5">
                {options.map((option) => {
                  const Icon = option.icon;
                  const active = target === option.target;
                  return <motion.button layout key={option.target} type="button" disabled={busy} onClick={() => { setTarget(option.target); setConfirmation(""); setError(""); }} whileTap={{ scale: 0.98 }} className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-4 text-left disabled:cursor-wait disabled:opacity-50 ${active ? "border-rose-300 bg-rose-50 ring-2 ring-rose-100" : "border-slate-200 hover:border-rose-200 hover:bg-slate-50"}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{option.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.description}</span></span><ChevronRight className={`h-5 w-5 shrink-0 transition-transform ${active ? "rotate-90 text-rose-500" : "text-slate-300"}`} /></motion.button>;
                })}
                <AnimatePresence initial={false}>{selected && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-bold text-rose-800">Tindakan ini tidak dapat dibatalkan</p><p className="mt-1 text-xs text-rose-700">Ketik <strong>HAPUS</strong> untuk mengonfirmasi “{selected.title}”.</p><Input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder="Ketik HAPUS" className="mt-3 h-12 border-rose-200 bg-white text-center font-bold tracking-[0.2em]" />{error && <p className="mt-2 rounded-lg bg-white p-2 text-xs font-medium text-rose-600">{error}</p>}<Button variant="destructive" disabled={confirmation !== "HAPUS" || busy} onClick={purge} className="mt-3 h-12 w-full rounded-xl">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{busy ? "Membersihkan..." : "Hapus permanen"}</Button></div></motion.div>}</AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
