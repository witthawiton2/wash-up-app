// Delivery.photoUrl is stored as a JSON-stringified array of URLs by the
// dashboard upload flow, but older rows may contain a single bare URL.
// Parse defensively in one place so every reader stays consistent.

export function parseDeliveryPhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((u): u is string => typeof u === "string");
    }
    return typeof raw === "string" ? [raw] : [];
  } catch {
    return typeof raw === "string" ? [raw] : [];
  }
}
