"use client";

import React, { useState } from "react";
import { Bell, BellRing, Check, CheckCircle2, ChevronRight, Smartphone, Sparkles } from "lucide-react";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

interface SystemNotificationPromptProps {
  variant?: "panel" | "banner";
  onSuccess?: () => void;
}

export function SystemNotificationPrompt({
  variant = "panel",
  onSuccess,
}: SystemNotificationPromptProps) {
  const {
    isSupported,
    isGranted,
    isDenied,
    isSubscribed,
    isLoading,
    subscribeToPush,
    sendTestNotification,
  } = usePushNotification();
  const { updateSetting } = useSettings();

  const [isEnabling, setIsEnabling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!isSupported || dismissed) return null;

  const handleEnableSystem = async () => {
    setIsEnabling(true);
    setMessage(null);
    try {
      const success = await subscribeToPush();
      if (success) {
        updateSetting("pushNotificationEnabled", true);
        setMessage("Izin sistem aktif! Notifikasi siap muncul di HP.");
        onSuccess?.();
      } else if (isDenied) {
        setMessage("Izin diblokir browser. Buka setelan browser untuk mengizinkan.");
      }
    } catch {
      setMessage("Gagal mengaktifkan izin sistem.");
    } finally {
      setIsEnabling(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        setMessage("Tes notifikasi terkirim! Cek layar HP Anda.");
      } else {
        setMessage(res.message || "Gagal mengirim notifikasi tes.");
      }
    } catch {
      setMessage("Gagal mengirim tes.");
    } finally {
      setIsTesting(false);
    }
  };

  // ── VARIANT: BANNER (Muncul di atas dashboard jika belum diizinkan) ──
  if (variant === "banner") {
    if (isGranted) return null; // Sembunyikan banner jika sudah aktif

    return (
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 p-3 sm:p-4 text-white shadow-lg shadow-indigo-600/15 animate-in fade-in slide-in-from-top-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur-md text-white ring-1 ring-white/30">
              <Smartphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-black tracking-wide">
                  Aktifkan Notifikasi Sistem Layar HP
                </p>
                <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  Penting
                </span>
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs text-indigo-100 line-clamp-1">
                Agar transaksi baru otomatis memunculkan banner & getar di HP seperti WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isEnabling || isLoading}
              onClick={handleEnableSystem}
              className="flex min-h-9 sm:min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-95 disabled:opacity-60"
            >
              <BellRing className="h-3.5 w-3.5 text-indigo-600" />
              <span>{isEnabling ? "Mengaktifkan..." : "Izinkan Sistem HP"}</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="grid h-9 w-9 place-items-center rounded-xl text-indigo-200 transition hover:bg-white/10 hover:text-white"
              title="Tutup banner ini"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VARIANT: PANEL (Muncul di dalam MobileSheet & Dropdown NotificationCenter) ──
  return (
    <div className="border-b border-slate-100 bg-slate-50/70 p-3 sm:p-3.5 transition-all">
      {!isGranted ? (
        <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">
                Izin Notifikasi Layar HP Belum Aktif
              </p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Aktifkan izin sistem agar HP Anda langsung bergetar dan memunculkan banner saat pesanan masuk.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isEnabling || isLoading}
            onClick={handleEnableSystem}
            className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{isEnabling ? "Menghubungkan ke HP..." : "Izinkan Notifikasi Sistem HP"}</span>
          </button>

          {message && (
            <p className="text-center text-[10px] font-semibold text-emerald-600">
              {message}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
            <span className="font-bold text-emerald-900 truncate text-[11px] sm:text-xs">
              Notifikasi Sistem HP Aktif
            </span>
          </div>

          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestNotification}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100 active:scale-95 disabled:opacity-60"
          >
            <BellRing className="h-3 w-3 text-emerald-600" />
            <span>{isTesting ? "Kirim..." : "Kirim Tes"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
