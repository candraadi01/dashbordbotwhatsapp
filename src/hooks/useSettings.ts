import { useCallback, useEffect, useRef, useState } from "react";
import { PeriodFilter } from "@/services/dashboardService";
import { NotificationSoundPreset } from "@/lib/notificationSound";

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

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      if (broadcast) {
        window.dispatchEvent(new CustomEvent<SettingsState>(SETTINGS_EVENT, { detail: next }));
      }
    } catch (error) {
      console.warn("Failed to save settings to localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const next = normaliseSettings(stored ? JSON.parse(stored) : null);
      settingsRef.current = next;
      setSettings(next);
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
      settingsRef.current = defaultSettings;
      setSettings(defaultSettings);
    } finally {
      setIsLoaded(true);
    }

    const handleSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<SettingsState>).detail;
      if (!detail) return;
      const next = normaliseSettings(detail);
      settingsRef.current = next;
      setSettings(next);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY || !event.newValue) return;
      try {
        const next = normaliseSettings(JSON.parse(event.newValue));
        settingsRef.current = next;
        setSettings(next);
      } catch (error) {
        console.warn("Failed to sync settings:", error);
      }
    };

    window.addEventListener(SETTINGS_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleStorage);
    return () => {
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
