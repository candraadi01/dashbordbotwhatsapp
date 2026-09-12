"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  ExternalLink,
  ShoppingCart,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { useSettings } from "@/hooks/useSettings";
import { usePushNotification } from "@/hooks/usePushNotification";
import { playNotificationSound } from "@/lib/notificationSound";
import { TransactionRow } from "@/types";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  transactionId?: string;
  type: "INSERT" | "UPDATE";
  status?: TransactionRow["status"];
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

const DISMISSED_STORAGE_KEY = "candra_dismissed_notifications";

function getDismissedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const set = getDismissedSet();
    ids.forEach((id) => set.add(id));
    const limited = Array.from(set).slice(-300);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(limited));
  } catch (e) {
    console.warn("Could not save dismissed notifications:", e);
  }
}

/* ─────────────────────────── helpers ─────────────────────────── */

function getTimeAgo(date: Date, now: number): string {
  if (!now) return "Baru saja";
  const seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return date.toLocaleDateString("id-ID");
}

function notificationIcon(notification: AppNotification) {
  if (notification.type === "INSERT")
    return { icon: ShoppingCart, style: "border-indigo-200 bg-indigo-50 text-indigo-600" };
  if (notification.status === "success")
    return { icon: CheckCircle2, style: "border-emerald-200 bg-emerald-50 text-emerald-600" };
  if (notification.status === "cancelled")
    return { icon: XCircle, style: "border-rose-200 bg-rose-50 text-rose-600" };
  return { icon: Clock3, style: "border-amber-200 bg-amber-50 text-amber-600" };
}

function transactionToNotification(row: TransactionRow, isInsert = false): AppNotification {
  const transactionId = row.transaction_id || row.id;
  const customer = row.customer_name || "Customer";
  const product = row.product_name || "Produk";
  const status = row.status;
  const statusLabel =
    status === "success" ? "Berhasil" : status === "cancelled" ? "Gagal" : "Pending";

  return {
    id: `tx:${row.id}:${row.status}:${row.updated_at || row.created_at}`,
    transactionId: row.transaction_id || row.id,
    type: isInsert ? "INSERT" : "UPDATE",
    status,
    title: isInsert ? "Transaksi baru masuk" : `Status ${statusLabel}`,
    message: isInsert
      ? `${customer} memesan ${product} (${row.duration || "-"}) · ${transactionId}`
      : `Pesanan ${transactionId} (${product}) milik ${customer} berubah menjadi ${statusLabel}.`,
    time: new Date(row.updated_at || row.created_at),
    read: false,
  };
}

/* ─────────────── notification item (shared) ─────────────────── */

function NotifItem({
  notification,
  now,
  onDismiss,
  onClick,
}: {
  notification: AppNotification;
  now: number;
  onDismiss: (id: string) => void;
  onClick?: (transactionId?: string) => void;
}) {
  const { icon: Icon, style } = notificationIcon(notification);
  return (
    <div
      onClick={() => onClick?.(notification.transactionId)}
      className={cn(
        "group relative flex flex-col gap-2 border-b border-slate-100 p-3.5 sm:p-4 text-left transition-colors active:bg-slate-100 cursor-pointer",
        !notification.read ? "bg-indigo-50/40 hover:bg-indigo-50/70" : "hover:bg-slate-50"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-sm", style)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 truncate">
              <span className="truncate">{notification.title}</span>
              {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 animate-pulse" />}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 shrink-0">
              <Clock className="h-3 w-3" /> {getTimeAgo(notification.time, now)}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 font-medium break-words">
            {notification.message}
          </p>
        </div>
      </div>

      {/* Action footer: field kecil "Tandai telah dibaca" & link detail */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/80 mt-0.5">
        <span className="text-[11px] font-bold text-indigo-600 group-hover:underline flex items-center gap-1">
          <span>Ubah status</span>
          <ExternalLink className="h-3 w-3" />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
          title="Tandai telah dibaca dan hapus notifikasi ini"
        >
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          <span>Tandai dibaca</span>
        </button>
      </div>
    </div>
  );
}

/* ─────────────── empty state (shared) ──────────────────────── */

function EmptyState() {
  return (
    <div className="px-5 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Bell className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700">Belum ada notifikasi baru</p>
      <p className="mt-1 text-xs text-slate-500">Aktivitas transaksi realtime akan otomatis muncul di sini.</p>
    </div>
  );
}

/* ──────────────────── panel header ──────────────────────────── */

function PanelHeader({
  unreadCount,
  onMarkAll,
  onClose,
  showClose,
}: {
  unreadCount: number;
  onMarkAll: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <h3 className="text-sm font-black text-slate-950">Notifikasi Realtime</h3>
        <p className="text-[11px] font-medium text-slate-500">Aktivitas pesanan bot WhatsApp</p>
      </div>
      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 active:scale-95"
          >
            <Check className="h-3.5 w-3.5" /> Tandai semua dibaca
          </button>
        )}
        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────── mobile bottom sheet (portal) ───────────────── */

function MobileSheet({
  isOpen,
  notifications,
  unreadCount,
  now,
  onClose,
  onDismiss,
  onMarkAll,
  onClickItem,
}: {
  isOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  now: number;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkAll: () => void;
  onClickItem: (transactionId?: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Notifikasi"
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2,6,23,0.45)",
          backdropFilter: "blur(4px)",
          transition: "opacity 300ms ease",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderTopLeftRadius: "1.5rem",
          borderTopRightRadius: "1.5rem",
          maxHeight: "85dvh",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          transition: "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "4px" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "#cbd5e1" }} />
        </div>

        <PanelHeader
          unreadCount={unreadCount}
          onMarkAll={onMarkAll}
          onClose={onClose}
          showClose
        />

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {notifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {notifications.map((n) => (
                <NotifItem
                  key={n.id}
                  notification={n}
                  now={now}
                  onDismiss={onDismiss}
                  onClick={onClickItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ──────────────────── main component ────────────────────────── */

export function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const { settings, isLoaded } = useSettings();
  const { isGranted, sendNotification } = usePushNotification();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentEventsRef = useRef<Map<string, number>>(new Map());
  const unreadCount = notifications.length;

  // Detect mobile (< 640px)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Click-outside for desktop dropdown
  useEffect(() => {
    if (isMobile) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  // Refresh relative timestamps while open
  useEffect(() => {
    if (!isOpen) return;
    setCurrentTime(Date.now());
    const id = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  // Initial load of recent transactions from database
  useEffect(() => {
    let active = true;
    async function fetchInitial() {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error || !data || !active) return;

        const dismissed = getDismissedSet();
        const initialList: AppNotification[] = [];

        for (const row of data) {
          const item = row as TransactionRow;
          const notifId = `tx:${item.id}:${item.status}:${item.updated_at || item.created_at}`;
          if (!dismissed.has(notifId) && !dismissed.has(item.id)) {
            initialList.push(transactionToNotification(item, item.status === "pending"));
          }
        }

        setNotifications(initialList);
      } catch (err) {
        console.warn("Failed to load initial notifications:", err);
      }
    }

    void fetchInitial();
    return () => {
      active = false;
    };
  }, []);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Realtime subscription via authenticated Supabase
  useEffect(() => {
    if (!isLoaded) return;

    const channel = transactionRealtimeService.subscribeTransactions((payload) => {
      const isInsert = payload.eventType === "INSERT";
      const isUpdate = payload.eventType === "UPDATE";
      if (!isInsert && !isUpdate) return;

      const data = payload.new as TransactionRow;
      const oldData = payload.old as Partial<TransactionRow>;
      if (!data || !data.id) return;

      const cur = settingsRef.current;
      if (!cur.notificationEnabled) return;

      const status = data.status;

      if (isInsert && !cur.notificationNewTransaction) return;
      if (isUpdate) {
        if (oldData?.status === status) return;
        if (status === "success" && !cur.notificationStatusSuccess) return;
        if (status === "pending" && !cur.notificationStatusPending) return;
        if (status === "cancelled" && !cur.notificationStatusCancelled) return;
      }

      const notifId = `tx:${data.id}:${status}:${data.updated_at || data.created_at}`;
      const dismissed = getDismissedSet();
      if (dismissed.has(notifId) || dismissed.has(data.id)) return;

      const now = Date.now();
      const lastSeen = recentEventsRef.current.get(notifId);
      if (lastSeen && now - lastSeen < 10_000) return;
      recentEventsRef.current.set(notifId, now);

      for (const [key, ts] of recentEventsRef.current) {
        if (now - ts > 60_000) recentEventsRef.current.delete(key);
      }

      const notif = transactionToNotification(data, isInsert);

      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notifId)].slice(0, 30));

      // 1. Kirim desktop notification lokal jika diizinkan di tab browser ini
      if (cur.pushNotificationEnabled && isGranted) {
        sendNotification({
          title: notif.title,
          body: notif.message,
          tag: notifId,
          data: { transactionId: notif.transactionId },
        });
      }

      // 2. SELALU kirim Web Push ke semua HP/perangkat terdaftar di latar belakang
      // Penting: Tidak boleh dihambat oleh izin lokal `isGranted`, agar HP tetap menerima push
      if (cur.pushNotificationEnabled) {
        void fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: notif.title,
            body: notif.message,
            url: `/dashboard/transactions?edit=${encodeURIComponent(notif.transactionId || "")}`,
            transactionId: notif.transactionId,
          }),
        }).catch((err) => console.warn("[NotificationCenter] Web Push dispatch failed:", err));
      }

      if (cur.soundAlert && cur.notificationSound !== "silent") {
        void playNotificationSound(
          cur.notificationSound,
          cur.notificationVolume,
          cur.customNotificationAudio
        ).catch((e) => console.warn("Could not play notification sound", e));
      }
    });

    return () => transactionRealtimeService.unsubscribe(channel);
  }, [isLoaded, isGranted, sendNotification]);

  // Polling fallback every 6 seconds to guarantee real-time delivery
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(async () => {
      try {
        const cur = settingsRef.current;
        if (!cur.notificationEnabled) return;

        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (error || !data) return;

        const dismissed = getDismissedSet();
        const now = Date.now();
        const newItems: AppNotification[] = [];

        for (const row of data) {
          const item = row as TransactionRow;
          const notifId = `tx:${item.id}:${item.status}:${item.updated_at || item.created_at}`;
          if (dismissed.has(notifId) || dismissed.has(item.id)) continue;
          if (recentEventsRef.current.has(notifId)) continue;

          // If created in the last 4 minutes or pending
          const ageMs = now - new Date(item.created_at).getTime();
          if (ageMs < 4 * 60 * 1000) {
            recentEventsRef.current.set(notifId, now);
            newItems.push(transactionToNotification(item, item.status === "pending"));
          }
        }

        if (newItems.length > 0) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const toAdd = newItems.filter((n) => !existingIds.has(n.id));
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev].slice(0, 30);
          });

          // Kirim Web Push ke HP untuk transaksi baru yang terdeteksi via polling
          if (cur.pushNotificationEnabled) {
            for (const item of newItems) {
              void fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: item.title,
                  body: item.message,
                  url: `/dashboard/transactions?edit=${encodeURIComponent(item.transactionId || "")}`,
                  transactionId: item.transactionId,
                }),
              }).catch((err) => console.warn("[NotificationCenter Polling] Web Push dispatch failed:", err));
            }
          }

          if (cur.soundAlert && cur.notificationSound !== "silent") {
            void playNotificationSound(
              cur.notificationSound,
              cur.notificationVolume,
              cur.customNotificationAudio
            ).catch(() => {});
          }
        }
      } catch {
        // Silently handle transient errors
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [isLoaded]);

  // Dismiss a single notification: saves to localStorage and immediately removes from state
  const handleDismissOne = useCallback((id: string) => {
    saveDismissedIds([id]);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Dismiss all notifications: saves all to localStorage and clears state
  const handleDismissAll = useCallback(() => {
    const allIds = notifications.map((n) => n.id);
    saveDismissedIds(allIds);
    setNotifications([]);
  }, [notifications]);

  // Navigate to transaction page and open status edit modal
  const handleItemClick = useCallback((transactionId?: string) => {
    if (transactionId) {
      router.push(`/dashboard/transactions?edit=${encodeURIComponent(transactionId)}`);
      setIsOpen(false);
    }
  }, [router]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 active:scale-95"
        aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} baru` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Mobile: portal bottom sheet ── */}
      {isMobile && (
        <MobileSheet
          isOpen={isOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          now={currentTime}
          onClose={() => setIsOpen(false)}
          onDismiss={handleDismissOne}
          onMarkAll={handleDismissAll}
          onClickItem={handleItemClick}
        />
      )}

      {/* ── Desktop: inline dropdown ── */}
      {!isMobile && isOpen && (
        <div className="absolute right-0 top-full z-[65] mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          <PanelHeader
            unreadCount={unreadCount}
            onMarkAll={handleDismissAll}
          />
          <div className="max-h-[min(65vh,420px)] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <NotifItem
                    key={n.id}
                    notification={n}
                    now={currentTime}
                    onDismiss={handleDismissOne}
                    onClick={handleItemClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
