// Canonical HH:MM slot list for both the customer booking form and the
// admin cap editor. Keep in sync with slotTimes in app/my/page.tsx.
export const SLOT_TIMES: readonly string[] = [
  "9:00", "9:30",
  "10:00", "10:30",
  "11:00", "11:30",
  "12:00", "12:30",
  "13:00", "13:30",
  "14:00", "14:30",
  "15:00", "15:30",
  "16:00", "16:30",
  "17:00", "17:30",
  "18:00", "18:30",
  "19:00", "19:30",
  "20:00",
] as const;

export const SLOT_METHODS = ["home", "self"] as const;
export type SlotMethod = (typeof SLOT_METHODS)[number];

// Maps the Thai method label (stored in Order.note by /api/my/booking)
// back to the canonical key we cap on.
export function methodKeyFromLabel(label: string): SlotMethod | null {
  if (label === "ฝากที่พัก") return "home";
  if (label === "รับด้วยตัวเอง") return "self";
  return null;
}

// Same regex the /api/bookings list route uses. Kept here so callers
// that only need the method (availability endpoint, booking POST) don't
// have to depend on that whole module.
export const NOTE_METHOD_RE = /\sวิธี:\s+([^|]+?)(?=\s+(?:โทร:|หมายเหตุ:)|\s+\||$)/;

export function extractMethodFromNote(note: string | null): SlotMethod | null {
  if (!note) return null;
  const m = note.match(NOTE_METHOD_RE);
  if (!m) return null;
  return methodKeyFromLabel(m[1].trim());
}

// Bangkok-local day boundaries as UTC Dates, for Prisma range queries.
// dateStr is "YYYY-MM-DD" from an HTML date input.
export function bangkokDayRange(dateStr: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${dateStr}T00:00:00+07:00`),
    lte: new Date(`${dateStr}T23:59:59.999+07:00`),
  };
}

// The customer picks slot times as "9:00", "9:30" etc. To match a row
// stored via `new Date(\`YYYY-MM-DDTHH:MM:00+07:00\`)` we normalise the
// wall-clock back to the same padded form. Kept as a single helper so
// the availability endpoint and the booking POST use identical strings.
export function formatSlotTimeFromDate(d: Date): string {
  const bkk = new Date(d.getTime()); // stored as UTC of Bangkok wall-clock
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(bkk);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Trim leading zero on hour so it matches the "9:00" style customers pick.
  return `${parseInt(hh, 10)}:${mm}`;
}
