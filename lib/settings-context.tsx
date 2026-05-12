"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AppSettings {
  logoUrl: string | null;
  companyName: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  lineId: string | null;
  promptpayId: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

const empty: AppSettings = {
  logoUrl: null,
  companyName: null,
  companyPhone: null,
  companyAddress: null,
  lineId: null,
  promptpayId: null,
  receiptHeader: null,
  receiptFooter: null,
};

interface SettingsContextType {
  settings: AppSettings;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: empty,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(empty);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          logoUrl: data.logoUrl ?? null,
          companyName: data.companyName ?? null,
          companyPhone: data.companyPhone ?? null,
          companyAddress: data.companyAddress ?? null,
          lineId: data.lineId ?? null,
          promptpayId: data.promptpayId ?? null,
          receiptHeader: data.receiptHeader ?? null,
          receiptFooter: data.receiptFooter ?? null,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
