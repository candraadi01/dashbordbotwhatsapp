"use client";

import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  Download,
  Music2,
  Play,
  ShoppingCart,
  Smartphone,
  Trash2,
  Upload,
  Volume2,
  XCircle,
} from "lucide-react";
import { useSettings, SettingsState } from "@/hooks/useSettings";
import { usePushNotification } from "@/hooks/usePushNotification";
import {
  NOTIFICATION_SOUND_OPTIONS,
  NotificationSoundPreset,
  playNotificationSound,
} from "@/lib/notificationSound";
import { cn } from "@/lib/utils";

const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className="relative h-7 w-12 rounded-full bg-slate-300 transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-checked:bg-indigo-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

const EVENT_OPTIONS: Array<{
  key: keyof Pick<
    SettingsState,
    | "notificationNewTransaction"
    | "notificationStatusSuccess"
    | "notificationStatusPending"
    | "notificationStatusCancelled"
  >;
  title: string;
  description: string;
  icon: typeof ShoppingCart;
  iconStyle: string;
}> = [
  {
    key: "notificationNewTransaction",
    title: "Transaksi baru",
    description: "Saat pesanan baru masuk dari WhatsApp.",
    icon: ShoppingCart,
    iconStyle: "bg-indigo-100 text-indigo-600",
  },
  {
    key: "notificationStatusSuccess",
    title: "Status berhasil",
    description: "Saat pembayaran dikonfirmasi berhasil.",
    icon: CheckCircle2,
    iconStyle: "bg-emerald-100 text-emerald-600",
  },
  {
    key: "notificationStatusPending",
    title: "Status pending",
    description: "Saat transaksi menunggu tindakan owner.",
    icon: Clock3,
    iconStyle: "bg-amber-100 text-amber-600",
  },
  {
    key: "notificationStatusCancelled",
    title: "Status gagal",
    description: "Saat pesanan dibatalkan atau gagal.",
    icon: XCircle,
    iconStyle: "bg-rose-100 text-rose-600",
  },
];

export function NotificationPreferences() {
  const { settings, updateSetting, saveAllSettings } = useSettings();
  const {
    permissionState,
    isSupported,
    isGranted,
    isDenied,
    isSubscribed,
    isLoading: pushLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  } = usePushNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [requestingPush, setRequestingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const selectSound = (sound: NotificationSoundPreset) => {
    updateSetting("notificationSound", sound);
    updateSetting("soundAlert", sound !== "silent");
    setMessage(null);
  };

  const testSound = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      await playNotificationSound(
        settings.notificationSound,
        settings.notificationVolume,
        settings.customNotificationAudio
      );
      if (settings.notificationSound === "silent") {
        setMessage({ type: "success", text: "Mode tanpa suara sedang dipilih." });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Suara belum dapat diputar. Sentuh halaman sekali lalu coba lagi.",
      });
    } finally {
      window.setTimeout(() => setIsTesting(false), 350);
    }
  };

  // Sinkronisasi file audio custom ke server agar perangkat HP dan Web Push dapat mengakses file yang sama
  useEffect(() => {
    if (settings.customNotificationAudio && settings.customNotificationAudio.startsWith("data:")) {
      fetch("/api/notifications/sound", { method: "HEAD" })
        .then((res) => {
          if (!res.ok) {
            return fetch("/api/notifications/sound", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio: settings.customNotificationAudio,
                fileName: settings.customNotificationAudioName || "custom_sound.mp3",
              }),
            });
          }
        })
        .catch(() => {});
    }
  }, [settings.customNotificationAudio, settings.customNotificationAudioName]);

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setMessage({ type: "error", text: "File harus berupa audio MP3, WAV, OGG, M4A, atau WebM." });
      return;
    }

    if (file.size > MAX_AUDIO_BYTES) {
      setMessage({ type: "error", text: "Ukuran audio maksimal 1,5 MB agar dashboard tetap ringan." });
      return;
    }

    // Upload audio ke server agar HP dan Web Push bisa membunyikan nada custom yang sama
    try {
      const formData = new FormData();
      formData.append("file", file);
      await fetch("/api/notifications/sound", {
        method: "POST",
        body: formData,
      });
    } catch (e) {
      console.warn("[handleAudioUpload] Server upload error:", e);
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      const dataUrl = reader.result;

      saveAllSettings({
        ...settings,
        customNotificationAudio: dataUrl,
        customNotificationAudioName: file.name,
        notificationSound: "custom",
        soundAlert: true,
      });

      setMessage({ type: "success", text: `Audio “${file.name}” berhasil dipasang dan diaktifkan sebagai nada notifikasi transaksi!` });

      // Putar preview audio langsung agar pengguna mendengar hasilnya
      void playNotificationSound("custom", settings.notificationVolume, dataUrl);
    };
    reader.onerror = () => setMessage({ type: "error", text: "File audio gagal dibaca. Silakan coba file lain." });
    reader.readAsDataURL(file);
  };

  const removeCustomAudio = () => {
    fetch("/api/notifications/sound", { method: "DELETE" }).catch(() => {});
    saveAllSettings({
      ...settings,
      customNotificationAudio: null,
      customNotificationAudioName: "",
      notificationSound: settings.notificationSound === "custom" ? "soft" : settings.notificationSound,
    });
    setMessage({ type: "success", text: "Audio custom berhasil dihapus." });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2">
      <div className="flex flex-col gap-3.5 border-b border-slate-200 bg-gradient-to-r from-indigo-50/70 via-white to-cyan-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-950 sm:text-lg">Pusat Notifikasi</h2>
            <p className="text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
              Atur aktivitas yang masuk serta suara pemberitahuannya.
            </p>
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white/90 px-3.5 py-2 sm:min-w-52 shadow-sm">
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900">Notifikasi Realtime</p>
            <p className={cn("text-[11px] font-semibold", settings.notificationEnabled ? "text-emerald-600" : "text-slate-400")}>
              {settings.notificationEnabled ? "Aktif" : "Nonaktif"}
            </p>
          </div>
          <Toggle
            checked={settings.notificationEnabled}
            onChange={(checked) => updateSetting("notificationEnabled", checked)}
            label="Aktifkan notifikasi realtime"
          />
        </div>
      </div>

      {/* Toggle Native OS Push Notification */}
      {isSupported && (
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Notifikasi OS / HP (Latar Belakang)</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Terima notifikasi native di layar HP meski browser/dashboard sedang ditutup.
                </p>
                {isDenied && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    Izin diblokir. Mohon izinkan notifikasi dari pengaturan browser Anda.
                  </p>
                )}
              </div>
            </div>
            <Toggle
              checked={isGranted}
              onChange={async (checked) => {
                if (checked) {
                  const ok = await subscribeToPush();
                  if (ok) {
                    updateSetting("pushNotificationEnabled", true);
                    setMessage({ type: "success", text: "Notifikasi OS / HP berhasil diaktifkan!" });
                  } else {
                    setMessage({ type: "error", text: "Gagal mengaktifkan notifikasi. Periksa izin browser Anda." });
                  }
                } else {
                  await unsubscribeFromPush();
                  updateSetting("pushNotificationEnabled", false);
                  setMessage({ type: "success", text: "Notifikasi OS / HP dinonaktifkan." });
                }
              }}
              label="Aktifkan Notifikasi OS"
            />
          </div>
          {isGranted && (
            <div className="mt-3 flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
              <p className="text-[11px] text-slate-500">Uji coba apakah notifikasi sampai ke layar HP Anda</p>
              <button
                type="button"
                disabled={testingPush}
                onClick={async () => {
                  setTestingPush(true);
                  setMessage(null);
                  // Bunyikan langsung nada custom / preset di perangkat ini
                  void playNotificationSound(
                    settings.notificationSound,
                    settings.notificationVolume,
                    settings.customNotificationAudio || "/api/notifications/sound"
                  );
                  const res = await sendTestNotification({
                    soundUrl: "/api/notifications/sound",
                  });
                  setTestingPush(false);
                  if (res.success) {
                    setMessage({
                      type: "success",
                      text: `Tes notifikasi berhasil dikirim! ${res.message || "Cek layar HP Anda sekarang."}`,
                    });
                  } else {
                    setMessage({
                      type: "error",
                      text: res.message || "Gagal mengirim notifikasi tes.",
                    });
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 active:scale-95 disabled:opacity-50"
              >
                <BellRing className="h-3.5 w-3.5" />
                {testingPush ? "Mengirim ke HP..." : "Kirim Tes ke HP"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className={cn("space-y-6 p-4 transition-opacity sm:p-5", !settings.notificationEnabled && "opacity-55")}>
        <fieldset disabled={!settings.notificationEnabled} className="space-y-3">
          <div>
            <legend className="text-sm font-black text-slate-900">Notifikasi yang diterima</legend>
            <p className="mt-1 text-xs leading-5 text-slate-500">Matikan jenis aktivitas yang tidak ingin mengganggu Anda.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {EVENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.key} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", option.iconStyle)}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{option.title}</p>
                    <p className="mt-0.5 text-xs leading-4 text-slate-500">{option.description}</p>
                  </div>
                  <Toggle
                    checked={settings[option.key]}
                    onChange={(checked) => updateSetting(option.key, checked)}
                    label={`Atur ${option.title}`}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset disabled={!settings.notificationEnabled} className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <legend className="text-sm font-black text-slate-900">Suara notifikasi</legend>
              <p className="mt-1 text-xs leading-5 text-slate-500">Pilih nada bawaan atau gunakan audio milik Anda sendiri.</p>
            </div>
            <button
              type="button"
              onClick={testSound}
              disabled={isTesting}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-[.98] disabled:cursor-wait"
            >
              <Play className="h-4 w-4" />
              {isTesting ? "Memutar..." : "Coba suara"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {NOTIFICATION_SOUND_OPTIONS.map((sound) => {
              const selected = settings.notificationSound === sound.value;
              return (
                <button
                  key={sound.value}
                  type="button"
                  onClick={() => selectSound(sound.value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[.99]",
                    selected
                      ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>
                    {sound.value === "silent" ? <Volume2 className="h-4 w-4 opacity-40" /> : <Music2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{sound.label}</span>
                    <span className="block truncate text-xs text-slate-500">{sound.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kartu Nada Audio Custom */}
          <div
            className={cn(
              "rounded-2xl border-2 transition-all p-4 sm:p-5 relative",
              settings.notificationSound === "custom"
                ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-200"
                : "border-dashed border-slate-300 bg-slate-50 hover:border-slate-400"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
              className="hidden"
              onChange={handleAudioUpload}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex min-w-0 items-center gap-3.5 cursor-pointer"
                onClick={() => {
                  if (settings.customNotificationAudioName) {
                    selectSound("custom");
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-xs transition-colors",
                    settings.notificationSound === "custom"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  )}
                >
                  {settings.notificationSound === "custom" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {settings.customNotificationAudioName || "Import Nada Dering Sendiri"}
                    </p>
                    {settings.notificationSound === "custom" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                        Aktif Digunakan
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {settings.customNotificationAudioName
                      ? "Audio custom Anda siap berbunyi otomatis saat ada transaksi masuk."
                      : "MP3, WAV, OGG, M4A, atau WebM · maksimal 1,5 MB"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {settings.customNotificationAudioName && (
                  <>
                    {settings.notificationSound !== "custom" ? (
                      <button
                        type="button"
                        onClick={() => selectSound("custom")}
                        className="min-h-10 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white transition hover:bg-indigo-700 active:scale-[.98]"
                      >
                        Gunakan Nada Ini
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        void playNotificationSound(
                          "custom",
                          settings.notificationVolume,
                          settings.customNotificationAudio
                        )
                      }
                      className="min-h-10 flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 active:scale-[.98]"
                      title="Coba dengarkan nada custom ini"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Dengar
                    </button>
                    <a
                      href={settings.customNotificationAudio || "/api/notifications/sound"}
                      download={settings.customNotificationAudioName || "candra-notifikasi.mp3"}
                      className="min-h-10 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[.98]"
                      title="Unduh file suara ke HP agar dapat disetel pada saluran notifikasi sistem HP"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh ke HP
                    </a>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "min-h-10 rounded-xl px-3.5 text-xs font-bold transition active:scale-[.98]",
                    settings.customNotificationAudioName
                      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {settings.customNotificationAudioName ? "Ganti file" : "Pilih audio"}
                </button>

                {settings.customNotificationAudioName && (
                  <button
                    type="button"
                    onClick={removeCustomAudio}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 active:scale-[.98]"
                    title="Hapus nada custom"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                )}
              </div>
            </div>

            {settings.customNotificationAudioName && (
              <div className="mt-3.5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-slate-700 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <Smartphone className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Petunjuk Notifikasi di HP (Layar Mati / Terkunci):</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Saat aplikasi sedang dibuka, nada custom Anda langsung berbunyi otomatis tanpa suara dobel. Saat HP terkunci / web ditutup, sistem HP mengatur suara notifikasi sebagai berikut:
                </p>

                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  {/* Panduan iPhone (iOS) */}
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs space-y-1.5">
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      Pengaturan iPhone (iOS)
                    </p>
                    <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-600 font-medium pl-0.5">
                      <li>Buka <b>Pengaturan iPhone → Pemberitahuan → CANDRA BOT</b>.</li>
                      <li>Centang <b>Layar Terkunci</b>, <b>Pusat Pemberitahuan</b>, &amp; <b>Spanduk</b>.</li>
                      <li>Ubah <b>Gaya Spanduk</b> ke <b>Tetap</b> &amp; pastikan <b>Bunyi</b> aktif.</li>
                      <li>Pastikan sakelar fisik hening di samping bodi iPhone tidak oranye.</li>
                    </ol>
                    <p className="text-[10px] text-slate-400 italic pt-0.5">
                      *Catatan Apple: iOS menggunakan nada sistem resmi Apple saat layar terkunci untuk menjaga keamanan baterai.
                    </p>
                  </div>

                  {/* Panduan Android */}
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs space-y-1.5">
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      Pengaturan Android
                    </p>
                    <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-600 font-medium pl-0.5">
                      <li>Klik tombol <b>Unduh ke HP</b> di atas.</li>
                      <li>Buka <b>Pengaturan HP → Aplikasi → CANDRA BOT → Notifikasi</b>.</li>
                      <li>Pilih <b>Kategori Notifikasi</b> → <b>Suara</b>.</li>
                      <li>Pilih file MP3 yang baru saja Anda unduh.</li>
                    </ol>
                    <p className="text-[10px] text-slate-400 italic pt-0.5">
                      *Android memungkinkan memilih file suara custom langsung untuk nada notifikasi layar mati.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center">
            <Volume2 className="h-5 w-5 shrink-0 text-indigo-600" />
            <label htmlFor="notification-volume" className="text-sm font-bold text-slate-800">Volume</label>
            <input
              id="notification-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.notificationVolume}
              onChange={(event) => updateSetting("notificationVolume", Number(event.target.value))}
              className="h-11 w-full accent-indigo-600 sm:h-2"
            />
            <span className="min-w-12 rounded-lg bg-white px-2 py-1 text-center text-sm font-black text-slate-700 shadow-sm">
              {settings.notificationVolume}%
            </span>
          </div>
        </fieldset>

        {message && (
          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm font-semibold",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}>
            {message.text}
          </div>
        )}

        {/* ── KARTU KHUSUS: Web Push Layar HP (Mobile-First & Clean) ── */}
        <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm space-y-3.5 sm:p-5">
          {/* Baris 1: Icon + Judul di kiri, Toggle di kanan */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">
                <Smartphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate">
                  Notifikasi Layar HP
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Web Push &amp; Layar Kunci
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <Toggle
                checked={Boolean(settings.pushNotificationEnabled && (isGranted || isSubscribed))}
                onChange={async (checked) => {
                  if (checked) {
                    setRequestingPush(true);
                    setMessage(null);
                    const success = await subscribeToPush();
                    setRequestingPush(false);
                    if (success) {
                      updateSetting("pushNotificationEnabled", true);
                      setMessage({
                        type: "success",
                        text: "Web Push HP aktif! Notifikasi transaksi otomatis muncul di layar HP Anda.",
                      });
                    } else {
                      setMessage({
                        type: "error",
                        text: isDenied
                          ? "Izin notifikasi ditolak browser. Buka setelan browser di HP Anda untuk mengizinkan."
                          : "Gagal menghubungkan Web Push. Pastikan koneksi stabil.",
                      });
                    }
                  } else {
                    setRequestingPush(true);
                    await unsubscribeFromPush();
                    updateSetting("pushNotificationEnabled", false);
                    setRequestingPush(false);
                    setMessage({
                      type: "success",
                      text: "Notifikasi Web Push layar HP telah dinonaktifkan.",
                    });
                  }
                }}
                label="Aktifkan notifikasi Web Push HP"
              />
            </div>
          </div>

          {/* Baris 2: Status Bar Perangkat */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="text-xs font-semibold text-slate-600">Status HP:</span>
            {!isSupported ? (
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                Tidak didukung
              </span>
            ) : isDenied ? (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                Izin diblokir
              </span>
            ) : settings.pushNotificationEnabled && (isGranted || isSubscribed) ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Aktif di Layar HP
              </span>
            ) : (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                Belum diaktifkan
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Notifikasi banner & getar langsung muncul di layar HP seperti WhatsApp, bahkan saat browser sedang ditutup.
          </p>

          {/* Baris 3: Tombol Aksi */}
          {isSupported && (isGranted || isSubscribed) ? (
            <div className="space-y-1.5 pt-0.5">
              <button
                type="button"
                disabled={testingPush}
                onClick={async () => {
                  setTestingPush(true);
                  setMessage(null);
                  // Bunyikan langsung nada custom / preset di perangkat ini
                  void playNotificationSound(
                    settings.notificationSound,
                    settings.notificationVolume,
                    settings.customNotificationAudio || "/api/notifications/sound"
                  );
                  const res = await sendTestNotification({
                    soundUrl: "/api/notifications/sound",
                  });
                  setTestingPush(false);
                  if (res.success) {
                    setMessage({
                      type: "success",
                      text: `Tes notifikasi berhasil dikirim! ${res.message || "Cek layar HP Anda sekarang."}`,
                    });
                  } else {
                    setMessage({
                      type: "error",
                      text: res.message || "Gagal mengirim notifikasi tes.",
                    });
                  }
                }}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 active:scale-95 disabled:opacity-50"
              >
                <BellRing className="h-3.5 w-3.5 text-violet-600" />
                <span>{testingPush ? "Mengirim ke Layar HP..." : "Kirim Tes Notifikasi ke Layar HP"}</span>
              </button>
            </div>
          ) : isSupported && !isGranted && !isDenied ? (
            <div className="pt-0.5">
              <button
                type="button"
                disabled={requestingPush || pushLoading}
                onClick={async () => {
                  setRequestingPush(true);
                  setMessage(null);
                  const success = await subscribeToPush();
                  setRequestingPush(false);
                  if (success) {
                    updateSetting("pushNotificationEnabled", true);
                    setMessage({
                      type: "success",
                      text: "Izin berhasil aktif! HP Anda kini siap menerima notifikasi.",
                    });
                  } else {
                    setMessage({
                      type: "error",
                      text: "Izin notifikasi belum diberikan atau ditolak.",
                    });
                  }
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 disabled:opacity-70"
              >
                <Smartphone className="h-4 w-4" />
                <span>{requestingPush ? "Menghubungkan ke HP..." : "Izinkan & Aktifkan Notifikasi HP"}</span>
              </button>
            </div>
          ) : null}

          {isDenied && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] leading-relaxed text-rose-800">
              <span className="font-bold">Izin diblokir browser:</span> Buka Pengaturan browser HP Anda → Setelan Situs → Notifikasi → Izinkan situs ini.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
