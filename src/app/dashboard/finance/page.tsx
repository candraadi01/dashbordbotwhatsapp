"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  MessageSquare,
  QrCode,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Image as ImageIcon,
  Smartphone,
  Copy,
  Check,
  Send,
  Sparkles,
  Info,
  Clock,
  CheckCheck,
  XCircle,
  ShieldCheck,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BotSettingsData {
  statusMessages: {
    pending: string;
    success: string;
    cancelled: string;
  };
  payment: {
    greetingTemplate: string;
    dana: string;
    bri: string;
    ewallet: string;
    accountName: string;
    footerNotes: string;
    qrisImageUrl: string;
  };
  updatedAt?: number;
}

const DEFAULT_SETTINGS: BotSettingsData = {
  statusMessages: {
    pending: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *PENDING*. Mohon menunggu konfirmasi admin ya!",
    success: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *BERHASIL*. Terima kasih telah berbelanja!",
    cancelled: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *DIBATALKAN*. Silakan hubungi admin jika ada kendala."
  },
  payment: {
    greetingTemplate: "Hello Kak *{customer}* 👋\n\ntotalnya jadi : *{total}*{discount}\nsilahkan lakukan pembayaran ya",
    dana: "081455124049",
    bri: "068001007528536",
    ewallet: "082338184217",
    accountName: "candra adi kusuma",
    footerNotes: "⚠️ BCA BISA SCAN QRIS 🔮\n🔔 Kirimkan bukti pembayaran untuk aktivasi paket Anda. Disini 📌Terima kasih!",
    qrisImageUrl: "/api/bot/qris"
  }
};

const VARIABLE_TAGS = [
  { tag: "{id}", label: "ID Transaksi", example: "CAKMTYB6T2DC7D3" },
  { tag: "{customer}", label: "Nama Customer", example: "Candra" },
  { tag: "{product}", label: "Nama Produk", example: "Netflix Premium" },
  { tag: "{category}", label: "Kategori", example: "1 Bulan UHD" },
  { tag: "{duration}", label: "Durasi", example: "30 Hari" },
  { tag: "{price}", label: "Total Harga", example: "Rp 35.000" },
  { tag: "{status}", label: "Status Pesanan", example: "BERHASIL" }
];

export default function BotSettingsPage() {
  const [activeTab, setActiveTab] = useState<"status" | "payment">("status");
  const [activeStatusKey, setActiveStatusKey] = useState<"pending" | "success" | "cancelled">("success");
  
  const [settings, setSettings] = useState<BotSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const [qrisTimestamp, setQrisTimestamp] = useState<number>(Date.now());
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [qrisUploadStatus, setQrisUploadStatus] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch initial settings from server
  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/bot/settings", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setSettings({
              statusMessages: {
                pending: json.data.statusMessages?.pending || DEFAULT_SETTINGS.statusMessages.pending,
                success: json.data.statusMessages?.success || DEFAULT_SETTINGS.statusMessages.success,
                cancelled: json.data.statusMessages?.cancelled || DEFAULT_SETTINGS.statusMessages.cancelled
              },
              payment: {
                greetingTemplate: json.data.payment?.greetingTemplate || DEFAULT_SETTINGS.payment.greetingTemplate,
                dana: json.data.payment?.dana || DEFAULT_SETTINGS.payment.dana,
                bri: json.data.payment?.bri || DEFAULT_SETTINGS.payment.bri,
                ewallet: json.data.payment?.ewallet || DEFAULT_SETTINGS.payment.ewallet,
                accountName: json.data.payment?.accountName || DEFAULT_SETTINGS.payment.accountName,
                footerNotes: json.data.payment?.footerNotes || DEFAULT_SETTINGS.payment.footerNotes,
                qrisImageUrl: json.data.payment?.qrisImageUrl || DEFAULT_SETTINGS.payment.qrisImageUrl
              },
              updatedAt: json.data.updatedAt
            });
          }
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan bot:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Save Settings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus(null);
      const res = await fetch("/api/bot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus({
          type: "success",
          message: "Pengaturan bot WhatsApp & pembayaran berhasil disimpan dan disinkronkan!"
        });
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        throw new Error(data.error || "Gagal menyimpan");
      }
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        message: err.message || "Terjadi kesalahan saat menyimpan pengaturan."
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    if (confirm("Kembalikan semua teks pesan dan format pembayaran ke default bawaan sistem?")) {
      setSettings(DEFAULT_SETTINGS);
      setSaveStatus({
        type: "success",
        message: "Form telah dikembalikan ke format default. Klik 'Simpan Pengaturan' untuk menerapkan."
      });
    }
  };

  // Insert tag into active status textarea
  const handleInsertTag = (tag: string) => {
    const currentVal = settings.statusMessages[activeStatusKey];
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
      
      setSettings(prev => ({
        ...prev,
        statusMessages: {
          ...prev.statusMessages,
          [activeStatusKey]: newVal
        }
      }));

      // Re-focus and update cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    } else {
      setSettings(prev => ({
        ...prev,
        statusMessages: {
          ...prev.statusMessages,
          [activeStatusKey]: currentVal + " " + tag
        }
      }));
    }

    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Upload QRIS Image
  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingQris(true);
      setQrisUploadStatus(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/bot/qris", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQrisTimestamp(Date.now());
        setQrisUploadStatus("Foto QRIS berhasil diperbarui di Web & Bot Panel!");
        setTimeout(() => setQrisUploadStatus(null), 5000);
      } else {
        throw new Error(data.error || "Gagal mengunggah QRIS");
      }
    } catch (err: any) {
      alert("Gagal upload QRIS: " + (err.message || "Periksa file"));
    } finally {
      setIsUploadingQris(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // WhatsApp formatted text helper for live preview
  const formatWhatsAppText = (text: string) => {
    // replace *bold*
    const boldFormatted = text.split(/(\*[^*]+\*)/g).map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
      }
      return part;
    });
    return boldFormatted;
  };

  // Preview status text resolver with mock data
  const getStatusPreviewText = () => {
    const template = settings.statusMessages[activeStatusKey] || "";
    const statusLabels = {
      pending: "PENDING",
      success: "BERHASIL",
      cancelled: "DIBATALKAN"
    };

    return template
      .replace(/\{id\}/gi, "CAKMTYB6T2DC7D3")
      .replace(/\{customer\}/gi, "Candra")
      .replace(/\{product\}/gi, "Netflix Premium")
      .replace(/\{category\}/gi, "1 Bulan UHD")
      .replace(/\{duration\}/gi, "30 Hari")
      .replace(/\{price\}/gi, "Rp 35.000")
      .replace(/\{status\}/gi, statusLabels[activeStatusKey]);
  };

  // Payment preview text resolver
  const getPaymentPreviewText = () => {
    const p = settings.payment;
    const greeting = (p.greetingTemplate || "")
      .replace(/\{customer\}/gi, "Candra")
      .replace(/\{total\}/gi, "Rp 35.000")
      .replace(/\{discount\}/gi, "");

    return `${greeting}

💳 Dana: ${p.dana || "-"}
💳 BRI: ${p.bri || "-"}
💳 gopay/shopeepay/ovo:      
      ${p.ewallet || "-"}
👤 An (${p.accountName || "-"})

${p.footerNotes || ""}`.trim();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72 bg-slate-200" />
        <Skeleton className="h-6 w-96 bg-slate-100" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[500px] lg:col-span-2 bg-slate-100 rounded-2xl" />
          <Skeleton className="h-[500px] bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-xs">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Pesan Bot & Pembayaran QRIS
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Atur pesan otomatis status pesanan ke customer & sesuaikan rincian transfer/QRIS bot.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs disabled:opacity-50"
            title="Kembalikan ke template default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Pengaturan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {saveStatus && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium border animate-in fade-in duration-200 ${
            saveStatus.type === "success"
              ? "bg-emerald-50/90 text-emerald-900 border-emerald-200"
              : "bg-red-50/90 text-red-900 border-red-200"
          }`}
        >
          {saveStatus.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span className="flex-1">{saveStatus.message}</span>
        </div>
      )}

      {/* Main Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("status")}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "status"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Pesan Status Customer
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
            WhatsApp
          </span>
        </button>

        <button
          onClick={() => setActiveTab("payment")}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "payment"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Rincian Pembayaran & QRIS
          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full">
            Foto + Text
          </span>
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Form Area (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === "status" ? (
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                  <span>Template Pesan Status Transaksi</span>
                  <span className="text-xs font-normal text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Auto kirim ke WhatsApp pembeli
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Pilih status transaksi untuk mengatur kata-kata pesan otomatis saat Anda mengubah status di Dashboard.
                </CardDescription>

                {/* Sub Status Filter Tabs */}
                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveStatusKey("pending")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      activeStatusKey === "pending"
                        ? "bg-amber-500 border-amber-600 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Status Pending
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStatusKey("success")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      activeStatusKey === "success"
                        ? "bg-emerald-600 border-emerald-700 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Status Berhasil
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStatusKey("cancelled")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      activeStatusKey === "cancelled"
                        ? "bg-red-500 border-red-600 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Status Gagal / Dibatalkan
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4">
                {/* Variable Tags Cloud */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                    <span>Sisipkan Variabel Dinamis (Klik untuk menambahkan):</span>
                    {copiedTag && (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                        <Check className="h-3 w-3" /> Disisipkan: {copiedTag}
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    {VARIABLE_TAGS.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => handleInsertTag(v.tag)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 transition-all shadow-2xs group"
                        title={`Klik untuk masukkan ${v.label} (Contoh: ${v.example})`}
                      >
                        <span className="text-emerald-600 font-bold group-hover:scale-110 transition-transform">+</span>
                        <span>{v.tag}</span>
                        <span className="text-[10px] font-sans text-slate-400 font-normal">({v.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Teks Pesan untuk Status:{" "}
                      <span className="uppercase text-emerald-700 font-black">
                        {activeStatusKey === "pending"
                          ? "Pending (Menunggu)"
                          : activeStatusKey === "success"
                          ? "Berhasil / Sukses"
                          : "Gagal / Dibatalkan"}
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Gunakan tanda *tebal* untuk huruf tebal
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={6}
                    value={settings.statusMessages[activeStatusKey]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        statusMessages: {
                          ...settings.statusMessages,
                          [activeStatusKey]: e.target.value
                        }
                      })
                    }
                    placeholder="Tulis format pesan WhatsApp di sini..."
                    className="w-full text-sm p-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans leading-relaxed text-slate-800 bg-slate-50/50"
                  />
                </div>

                {/* Helpful Note */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-xs text-blue-800">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    Pesan ini akan dikirimkan otomatis oleh bot WhatsApp ke nomor customer ketika Anda menekan tombol simpan status transaksi di popup/modal transaksi dashboard web.
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* PAYMENT & QRIS TAB */
            <div className="space-y-6">
              {/* QRIS Image Upload Card */}
              <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-indigo-600" /> Foto QRIS Pembayaran Bot
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Foto ini dikirimkan langsung oleh bot bersamaan dengan rincian total bayar & nomor rekening.
                      </CardDescription>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      QRIS Aktif
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="relative h-44 w-44 rounded-xl overflow-hidden border border-slate-300 shadow-sm bg-white shrink-0 group">
                      <Image
                        src={`/api/bot/qris?t=${qrisTimestamp}`}
                        alt="QRIS Pembayaran Bot"
                        fill
                        className="object-contain p-1.5"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a
                          href={`/api/bot/qris?t=${qrisTimestamp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Lihat Penuh
                        </a>
                      </div>
                    </div>

                    <div className="space-y-3 text-center sm:text-left flex-1">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Ganti Foto QRIS</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Format JPG atau PNG. Ukuran disarankan kotak (1:1) agar barcode terbaca jelas oleh pembeli.
                        </p>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleQrisUpload}
                        className="hidden"
                      />

                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingQris}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-2xs disabled:opacity-50"
                        >
                          {isUploadingQris ? (
                            <>
                              <div className="h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              Mengunggah...
                            </>
                          ) : (
                            <>
                              <UploadCloud className="h-4 w-4" />
                              Upload QRIS Baru
                            </>
                          )}
                        </button>
                      </div>

                      {qrisUploadStatus && (
                        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {qrisUploadStatus}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank & E-Wallet Numbers Card */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Rincian Rekening & E-Wallet
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Informasi akun pembayaran yang akan dicantumkan pada caption pesan gambar bot WhatsApp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Template Sapaan */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Template Sapaan & Total Harga
                    </label>
                    <textarea
                      rows={3}
                      value={settings.payment.greetingTemplate}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          payment: { ...settings.payment, greetingTemplate: e.target.value }
                        })
                      }
                      placeholder="Contoh: Hello Kak *{customer}*..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-sans"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Variabel yang didukung: <code className="font-mono text-emerald-600">&#123;customer&#125;</code>, <code className="font-mono text-emerald-600">&#123;total&#125;</code>, <code className="font-mono text-emerald-600">&#123;discount&#125;</code>.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* DANA */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nomor DANA
                      </label>
                      <input
                        type="text"
                        value={settings.payment.dana}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, dana: e.target.value }
                          })
                        }
                        placeholder="Contoh: 081455124049"
                        className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      />
                    </div>

                    {/* BRI */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nomor Rekening BRI
                      </label>
                      <input
                        type="text"
                        value={settings.payment.bri}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, bri: e.target.value }
                          })
                        }
                        placeholder="Contoh: 068001007528536"
                        className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      />
                    </div>

                    {/* GoPay / ShopeePay / OVO */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nomor GoPay / ShopeePay / OVO
                      </label>
                      <input
                        type="text"
                        value={settings.payment.ewallet}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, ewallet: e.target.value }
                          })
                        }
                        placeholder="Contoh: 082338184217"
                        className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono"
                      />
                    </div>

                    {/* Atas Nama */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Atas Nama (A/N)
                      </label>
                      <input
                        type="text"
                        value={settings.payment.accountName}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, accountName: e.target.value }
                          })
                        }
                        placeholder="Contoh: candra adi kusuma"
                        className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-sans"
                      />
                    </div>
                  </div>

                  {/* Catatan Bawah / Footer */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Catatan Tambahan / Footer Bukti Pembayaran
                    </label>
                    <textarea
                      rows={3}
                      value={settings.payment.footerNotes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          payment: { ...settings.payment, footerNotes: e.target.value }
                        })
                      }
                      placeholder="Contoh: ⚠️ BCA BISA SCAN QRIS..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-sans"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Area: Interactive WhatsApp Live Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              Live Preview WhatsApp
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Tampilan Pelanggan
            </span>
          </div>

          {/* Smartphone Frame */}
          <div className="rounded-3xl border-4 border-slate-800 bg-[#0c1317] p-2 shadow-2xl overflow-hidden max-w-[380px] mx-auto w-full">
            {/* Phone Speaker Notch */}
            <div className="h-4 w-full flex items-center justify-center">
              <div className="h-1 w-12 rounded-full bg-slate-700" />
            </div>

            {/* WhatsApp App Container */}
            <div className="rounded-2xl overflow-hidden flex flex-col bg-[#efeae2] border border-slate-700 text-slate-800 min-h-[500px]">
              {/* WhatsApp Top Header Bar */}
              <div className="bg-[#008069] text-white p-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-8 w-8 rounded-full overflow-hidden bg-white/20 ring-1 ring-white/30 shrink-0">
                    <Image
                      src="/brand/candra-bot-logo.png"
                      alt="Candra Bot"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold leading-none">Candra Bot Official</h3>
                    <p className="text-[10px] text-emerald-100 leading-none mt-1">online</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <ShieldCheck className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 p-3.5 space-y-3 bg-[#efeae2] overflow-y-auto">
                {/* Date stamp bubble */}
                <div className="flex justify-center">
                  <span className="px-2.5 py-0.5 rounded-md bg-white/80 backdrop-blur-xs text-[10px] font-bold text-slate-500 shadow-2xs">
                    HARI INI
                  </span>
                </div>

                {/* Simulated Bubble */}
                {activeTab === "status" ? (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl rounded-tl-xs p-3 text-xs bg-white text-slate-800 shadow-sm border border-slate-200/60 relative space-y-2">
                      <div className="whitespace-pre-wrap leading-relaxed text-[12px] font-normal text-slate-900">
                        {formatWhatsAppText(getStatusPreviewText())}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                        <span>14:02</span>
                        <CheckCheck className="h-3 w-3 text-blue-500" />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Payment Preview matching Photo 5 */
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-tl-xs overflow-hidden text-xs bg-white text-slate-800 shadow-sm border border-slate-200/60 relative">
                      {/* Attached QRIS image */}
                      <div className="relative w-full aspect-square bg-slate-100">
                        <Image
                          src={`/api/bot/qris?t=${qrisTimestamp}`}
                          alt="QRIS WhatsApp Preview"
                          fill
                          className="object-contain p-2"
                          unoptimized
                        />
                      </div>

                      {/* Payment details caption */}
                      <div className="p-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-900 space-y-1">
                        {formatWhatsAppText(getPaymentPreviewText())}
                      </div>

                      <div className="flex items-center justify-end gap-1 px-3 pb-2 text-[10px] text-slate-400">
                        <span>14:03</span>
                        <CheckCheck className="h-3 w-3 text-blue-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp Fake Input Bar */}
              <div className="p-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-slate-400 border border-slate-200">
                  Ketik pesan...
                </div>
                <div className="h-7 w-7 rounded-full bg-[#008069] flex items-center justify-center text-white shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
