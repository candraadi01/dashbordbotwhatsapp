"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Coins, Gift, Loader2, MinusCircle, PlusCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customerService, LoyaltyAction } from "@/services/customerService";
import { CustomerWithAnalytics } from "@/types";
import { formatIDR } from "@/lib/utils";

type Props = { customer: CustomerWithAnalytics; onUpdated: () => void };
const actions: Array<{ value: LoyaltyAction; label: string; help: string; icon: typeof Coins; tone: string }> = [
  { value: "ADD", label: "Tambah", help: "Bonus/manual", icon: PlusCircle, tone: "text-indigo-600 bg-indigo-50" },
  { value: "DEDUCT", label: "Kurangi", help: "Koreksi poin", icon: MinusCircle, tone: "text-rose-600 bg-rose-50" },
  { value: "REDEEM", label: "Tukar", help: "10 poin = Rp1.000", icon: Gift, tone: "text-emerald-600 bg-emerald-50" },
];

export function LoyaltyManager({ customer, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<LoyaltyAction>("REDEEM");
  const [points, setPoints] = useState(10);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const discount = useMemo(() => action === "REDEEM" ? Math.floor(points / 10) * 1000 : 0, [action, points]);

  function close() {
    if (!busy) { setOpen(false); setError(""); }
  }

  async function save() {
    if (points <= 0 || points % 10 !== 0) { setError("Jumlah poin harus kelipatan 10."); return; }
    setBusy(true); setError("");
    try {
      await customerService.manageLoyalty(customer.id, action, points, note);
      setOpen(false); setNote(""); setPoints(10); onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Poin gagal diperbarui.");
    } finally { setBusy(false); }
  }

  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-9 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">
      <Coins className="mr-1.5 h-4 w-4" />Poin
    </Button>
    <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <motion.div role="dialog" aria-modal="true" initial={{ y: 80, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 80, opacity: 0, scale: .98 }} transition={{ type: "spring", damping: 26, stiffness: 330 }} className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Program loyalitas</p><h2 className="mt-1 text-lg font-black text-slate-950">{customer.customer_name}</h2><p className="text-xs text-slate-500">{customer.customer_phone.replace("@lid", "")}</p></div>
          <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Poin tersedia</p><p className="mt-1 text-2xl font-black text-amber-900">{customer.loyalty_points}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Saldo diskon</p><p className="mt-1 text-xl font-black text-emerald-900">{formatIDR(customer.discount_balance)}</p></div></div>
          <div className="grid grid-cols-3 gap-2">{actions.map((item) => { const Icon=item.icon; const active=action===item.value; return <button key={item.value} type="button" onClick={() => { setAction(item.value); setError(""); }} className={`min-h-20 rounded-2xl border p-2 text-center transition active:scale-95 ${active ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}><span className={`mx-auto grid h-8 w-8 place-items-center rounded-xl ${item.tone}`}><Icon className="h-4 w-4" /></span><span className="mt-1 block text-xs font-bold text-slate-900">{item.label}</span><span className="block text-[10px] text-slate-400">{item.help}</span></button> })}</div>
          <label className="block text-sm font-bold text-slate-700">Jumlah poin<input value={points || ""} onChange={(event) => setPoints(Number(event.target.value))} type="number" min="10" step="10" inputMode="numeric" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-black outline-none focus:border-indigo-400" /></label>
          {action === "REDEEM" && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">Customer akan memperoleh saldo potongan <strong>{formatIDR(discount)}</strong> untuk transaksi berikutnya.</p>}
          <label className="block text-sm font-bold text-slate-700">Catatan (opsional)<Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: reward pelanggan setia" className="mt-2 h-11" /></label>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
          <Button onClick={save} disabled={busy} className="h-12 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}{busy ? "Menyimpan..." : "Simpan perubahan poin"}</Button>
        </div>
      </motion.div>
    </motion.div>}</AnimatePresence>
  </>;
}
