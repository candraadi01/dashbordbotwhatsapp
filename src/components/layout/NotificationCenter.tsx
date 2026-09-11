"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  ShoppingCart,
  X,
  XCircle,
} from "lucide-react";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { useSettings } from "@/hooks/useSettings";
import { playNotificationSound } from "@/lib/notificationSound";
import { TransactionRow } from "@/types";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  type: "INSERT" | "UPDATE";
  status?: TransactionRow["status"];
  title: string;
  message: string;
  time: Date;
  read: boolean;
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

/* ─────────────── notification item (shared) ─────────────────── */

function NotifItem({
  notification,
  now,
  onRead,
}: {
  notification: AppNotification;
  now: number;
  onRead: (id: string) => void;
}) {
  const { icon: Icon, style } = notificationIcon(notification);
  return (
    <button
      type="button"
      onClick={() => onRead(notification.id)}
      className={cn(
        "flex w-full gap-3 px-4 py-3.5 text-left transition-colors active:bg-slate-100",
        !notification.read ? "bg-indigo-50/40" : "hover:bg-slate-50"
      )}
    >
      <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border", style)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          {notification.title}
          {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{notification.message}</span>
        <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-400">
          <Clock className="h-3 w-3" /> {getTimeAgo(notification.time, now)}
        </span>
      </span>
    </button>
  );
}

/* ─────────────── empty state (shared) ──────────────────────── */

function EmptyState() {
  return (
    <div className="px-5 py-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Bell className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700">Belum ada notifikasi baru</p>
      <p className="mt-1 text-xs text-slate-500">Aktivitas yang dipilih akan muncul di sini.</p>
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
        <h3 className="text-sm font-black text-slate-950">Notifikasi</h3>
        <p className="text-[11px] font-medium text-slate-500">Aktivitas transaksi secara realtime</p>
      </div>
      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
          >
            <Check className="h-3.5 w-3.5" /> Tandai dibaca
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
  onRead,
  onMarkAll,
}: {
  isOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  now: number;
  onClose: () => void;
  onRead: (id: string) => void;
  onMarkAll: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Small delay so CSS transition fires after mount
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
          maxHeight: "82dvh",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          transition: "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          // iOS safe area
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "2px" }}>
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
                <NotifItem key={n.id} notification={n} now={now} onRead={onRead} />
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const { settings, isLoaded } = useSettings();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentEventsRef = useRef<Map<string, number>>(new Map());
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Detect mobile (< 640px) — refreshed on open
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Click-outside for desktop dropdown only
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

  // Realtime subscription
  useEffect(() => {
    if (!isLoaded || !settings.notificationEnabled) return;

    const channel = transactionRealtimeService.subscribeTransactions((payload) => {
      const isInsert = payload.eventType === "INSERT";
      const isUpdate = payload.eventType === "UPDATE";
      if (!isInsert && !isUpdate) return;

      const data = payload.new as TransactionRow;
      const oldData = payload.old as Partial<TransactionRow>;
      const status = data.status;

      if (isInsert && !settings.notificationNewTransaction) return;
      if (isUpdate) {
        if (oldData.status === status) return;
        if (status === "success" && !settings.notificationStatusSuccess) return;
        if (status === "pending" && !settings.notificationStatusPending) return;
        if (status === "cancelled" && !settings.notificationStatusCancelled) return;
      }

      const eventKey = `${payload.eventType}:${data.id}:${status}:${data.updated_at}`;
      const now = Date.now();
      const lastSeen = recentEventsRef.current.get(eventKey);
      if (lastSeen && now - lastSeen < 10_000) return;
      recentEventsRef.current.set(eventKey, now);
      for (const [key, ts] of recentEventsRef.current) {
        if (now - ts > 60_000) recentEventsRef.current.delete(key);
      }

      const transactionId = data.transaction_id || data.id.slice(0, 8).toUpperCase();
      const customer = data.customer_name || "Customer";
      const product = data.product_name || "Produk";
      const statusLabel =
        status === "success" ? "Berhasil" : status === "cancelled" ? "Gagal" : "Pending";

      const next: AppNotification = {
        id: eventKey,
        type: isInsert ? "INSERT" : "UPDATE",
        status: isUpdate ? status : undefined,
        title: isInsert ? "Transaksi baru" : `Status ${statusLabel}`,
        message: isInsert
          ? `${customer} memesan ${product} · ${transactionId}`
          : `Pesanan ${transactionId} milik ${customer} menjadi ${statusLabel}.`,
        time: new Date(),
        read: false,
      };

      setNotifications((prev) => [next, ...prev].slice(0, 30));

      if (settings.soundAlert && settings.notificationSound !== "silent") {
        void playNotificationSound(
          settings.notificationSound,
          settings.notificationVolume,
          settings.customNotificationAudio
        ).catch((e) => console.warn("Could not play notification sound", e));
      }
    });

    return () => transactionRealtimeService.unsubscribe(channel);
  }, [
    isLoaded,
    settings.notificationEnabled,
    settings.notificationNewTransaction,
    settings.notificationStatusSuccess,
    settings.notificationStatusPending,
    settings.notificationStatusCancelled,
    settings.soundAlert,
    settings.notificationSound,
    settings.notificationVolume,
    settings.customNotificationAudio,
  ]);

  const markAllAsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markOneAsRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 active:scale-95"
        aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`}
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
          onRead={markOneAsRead}
          onMarkAll={markAllAsRead}
        />
      )}

      {/* ── Desktop: inline dropdown ── */}
      {!isMobile && isOpen && (
        <div className="absolute right-0 top-full z-[65] mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          <PanelHeader
            unreadCount={unreadCount}
            onMarkAll={markAllAsRead}
          />
          <div className="max-h-[min(65vh,420px)] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <NotifItem key={n.id} notification={n} now={currentTime} onRead={markOneAsRead} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
