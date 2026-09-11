"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock, Package, ShoppingCart } from "lucide-react";
import { transactionRealtimeService } from "@/services/transactionRealtimeService";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase";

export interface AppNotification {
  id: string;
  type: "INSERT" | "UPDATE";
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { settings, isLoaded } = useSettings();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Click outside to close
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLoaded || !settings.notificationEnabled) return;

    const channel = transactionRealtimeService.subscribeTransactions((payload) => {
      const isInsert = payload.eventType === "INSERT";
      const isUpdate = payload.eventType === "UPDATE";
      
      if (isInsert || isUpdate) {
         
        const data = payload.new as any;
        
        let title = "";
        let message = "";
        
        if (isInsert) {
          title = "Transaksi Baru";
          message = `${data.customer_name || "Customer"} memesan ${data.product_name || "Produk"}`;
        } else if (isUpdate) {
          title = "Perubahan Status";
          message = `Status pesanan ${data.customer_name || "Customer"} menjadi ${data.status}`;
        }

        const newNotif: AppNotification = {
          id: Math.random().toString(36).substring(2, 9),
          type: isInsert ? "INSERT" : "UPDATE",
          title,
          message,
          time: new Date(),
          read: false,
        };

        setNotifications((prev) => [newNotif, ...prev].slice(0, 20));

        if (settings.soundAlert) {
          playAlertSound();
        }
      }
    });

    return () => {
      transactionRealtimeService.unsubscribe(channel);
    };
  }, [isLoaded, settings.notificationEnabled, settings.soundAlert]);

  const playAlertSound = () => {
    try {
      // Basic beep using web audio api
       
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 150);
    } catch (e) {
      console.warn("Could not play sound", e);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Baru saja";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mnt lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    return date.toLocaleDateString("id-ID");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-950"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 border border-slate-900 animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-950 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Belum ada notifikasi baru
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 ${
                      !notif.read ? "bg-slate-100/20" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {notif.type === "INSERT" ? (
                        <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {notif.title}
                        {!notif.read && (
                          <span className="ml-2 inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        {getTimeAgo(notif.time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
