export interface PrintSettings {
  autoPrint: boolean;
  copies: number;
  paperWidth: "58mm" | "80mm";
}

const STORAGE_KEY = "washup_print_settings";

const defaults: PrintSettings = {
  autoPrint: false,
  copies: 1,
  paperWidth: "80mm",
};

export function getPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaults;
}

export function savePrintSettings(settings: Partial<PrintSettings>) {
  const current = getPrintSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
