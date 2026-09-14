import { useCallback, useEffect, useRef, useState } from "react";
import { PeriodFilter } from "@/services/dashboardService";
import { NotificationSoundPreset, clearAudioBufferCache } from "@/lib/notificationSound";
import { getAudioFromStorage, saveAudioToStorage, removeAudioFromStorage } from "@/lib/audioStorage";

export interface SettingsState {
  realtimeOn: boolean;
  autoRefresh: boolean;
  defaultPeriod: PeriodFilter;
  notificationEnabled: boolean;
  soundAlert: boolean;
  notificationNewTransaction: boolean;
  notificationStatusSuccess: boolean;
  notificationStatusPending: boolean;
  notificationStatusCancelled: boolean;
  notificationSound: NotificationSoundPreset;
  notificationVolume: number;
  customNotificationAudio: string | null;
  customNotificationAudioName: string;
  customerScoreEnabled: boolean;
  customerPointsEnabled: boolean;
  pushNotificationEnabled: boolean;
}

const SETTINGS_KEY = "candra_admin_settings";
const SETTINGS_EVENT = "candra_admin_settings_changed";

const defaultSettings: SettingsState = {
  realtimeOn: true,
  autoRefresh: true,
  defaultPeriod: "7days",
  notificationEnabled: true,
  soundAlert: true,
  notificationNewTransaction: true,
  notificationStatusSuccess: true,
  notificationStatusPending: true,
  notificationStatusCancelled: true,
  notificationSound: "soft",
  notificationVolume: 65,
  customNotificationAudio: null,
  customNotificationAudioName: "",
  customerScoreEnabled: true,
  customerPointsEnabled: true,
  pushNotificationEnabled: false,
};

function normaliseSettings(value?: Partial<SettingsState> | null): SettingsState {
  const merged = { ...defaultSettings, ...(value ?? {}) };
  return {
    ...merged,
    notificationVolume: Math.min(100, Math.max(0, Number(merged.notificationVolume) || 0)),
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef<SettingsState>(defaultSettings);

  const applySettings = useCallback((next: SettingsState, broadcast = true) => {
    settingsRef.current = next;
    setSettings(next);

    // 1. Simpan audio custom ke IndexedDB agar tidak memberatkan / melebihi kuota localStorage
    if (next.customNotificationAudio) {
      void saveAudioToStorage(next.customNotificationAudio);
    } else if (next.notificationSound !== "custom") {
      clearAudioBufferCache();
    }

    // 2. Simpan ke localStorage dengan proteksi kuota
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Jika base64 audio terlalu besar untuk localStorage, simpan tanpa string audio utuh
      // (karena audio sudah aman tersimpan di IndexedDB)
      try {
        const lean = { ...next, customNotificationAudio: null };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(lean));
      } catch (err) {
        console.warn("[useSettings] Gagal menyimpan settings ke localStorage:", err);
      }
    }

    // 3. Broadcast perubahan ke semua tab/komponen
    if (broadcast) {
      window.dispatchEvent(new CustomEvent<SettingsState>(SETTINGS_EVENT, { detail: next }));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initSettings() {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        const next = normaliseSettings(stored ? JSON.parse(stored) : null);

        // Jika ada custom audio di IndexedDB tapi belum ada di state (misal karena disimpan lean di localStorage)
        if (!next.customNotificationAudio && (next.notificationSound === "custom" || next.customNotificationAudioName)) {
          const storedAudio = await getAudioFromStorage();
          if (storedAudio && active) {
            next.customNotificationAudio = storedAudio;
          } else if (active) {
            try {
              const res = await fetch("/api/notifications/sound", { method: "HEAD" });
              if (res.ok) {
                const headerName = res.headers.get("X-Audio-Filename");
                next.customNotificationAudio = "/api/notifications/sound";
                if (headerName) {
                  next.customNotificationAudioName = decodeURIComponent(headerName);
                }
              }
            } catch {}
          }
        } else if (!next.customNotificationAudio) {
          // Cek apakah ada custom sound di server yang tersimpan dari perangkat lain (misal dari PC ke HP)
          try {
            const res = await fetch("/api/notifications/sound", { method: "HEAD" });
            if (res.ok && active) {
              const headerName = res.headers.get("X-Audio-Filename");
              next.customNotificationAudio = "/api/notifications/sound";
              next.customNotificationAudioName = headerName ? decodeURIComponent(headerName) : "Custom Sound Server";
              if (next.notificationSound !== "silent") {
                next.notificationSound = "custom";
              }
            }
          } catch {}
        }

        if (active) {
          settingsRef.current = next;
          setSettings(next);
        }
      } catch (error) {
        console.warn("Failed to load settings:", error);
        if (active) {
          settingsRef.current = defaultSettings;
          setSettings(defaultSettings);
        }
      } finally {
        if (active) {
          setIsLoaded(true);
        }
      }
    }

    void initSettings();

    const handleSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<SettingsState>).detail;
      if (!detail) return;
      const next = normaliseSettings(detail);
      settingsRef.current = next;
      setSettings(next);
    };

    const handleStorage = async (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY || !event.newValue) return;
      try {
        const next = normaliseSettings(JSON.parse(event.newValue));
        if (!next.customNotificationAudio && next.notificationSound === "custom") {
          const storedAudio = await getAudioFromStorage();
          if (storedAudio) next.customNotificationAudio = storedAudio;
        }
        settingsRef.current = next;
        setSettings(next);
      } catch (error) {
        console.warn("Failed to sync settings:", error);
      }
    };

    window.addEventListener(SETTINGS_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener(SETTINGS_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateSetting = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    applySettings({ ...settingsRef.current, [key]: value });
  }, [applySettings]);

  const saveAllSettings = useCallback((newSettings: SettingsState) => {
    applySettings(normaliseSettings(newSettings));
  }, [applySettings]);

  return {
    settings,
    isLoaded,
    updateSetting,
    saveAllSettings,
  };
}
