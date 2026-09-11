import { useState, useEffect } from "react";
import { PeriodFilter } from "@/services/dashboardService";

export interface SettingsState {
  realtimeOn: boolean;
  autoRefresh: boolean;
  defaultPeriod: PeriodFilter;
  notificationEnabled: boolean;
  soundAlert: boolean;
  customerScoreEnabled: boolean;
  customerPointsEnabled: boolean;
}

const SETTINGS_KEY = "candra_admin_settings";

const defaultSettings: SettingsState = {
  realtimeOn: true,
  autoRefresh: true,
  defaultPeriod: "7days",
  notificationEnabled: true,
  soundAlert: true,
  customerScoreEnabled: true,
  customerPointsEnabled: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.warn("Failed to load settings from localStorage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateSetting = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save settings to localStorage:", e);
      }
      return next;
    });
  };

  const saveAllSettings = (newSettings: SettingsState) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn("Failed to save settings to localStorage:", e);
    }
  };

  return {
    settings,
    isLoaded,
    updateSetting,
    saveAllSettings,
  };
}
