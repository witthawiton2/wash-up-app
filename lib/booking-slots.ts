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

// The delivery method the customer picks for how they receive their laundry.
// Kept for typing Order.deliveryMethod — it no longer drives slot capacity.
export const SLOT_METHODS = ["home", "self"] as const;
export type SlotMethod = (typeof SLOT_METHODS)[number];

// Maps the Thai method label (stored in the "วิธี:" note segment) back to the
// delivery-method key. Kept for the deliveryMethod backfill — capacity no
// longer keys on method.
export function methodKeyFromLabel(label: string): SlotMethod | null {
  if (label === "ฝากที่พัก") return "home";
  if (label === "รับด้วยตัวเอง") return "self";
  return null;
}

export const NOTE_METHOD_RE = /\sวิธี:\s+([^|]+?)(?=\s+(?:โทร:|หมายเหตุ:)|\s+\||$)/;

export function extractMethodFromNote(note: string | null): SlotMethod | null {
  if (!note) return null;
  const m = note.match(NOTE_METHOD_RE);
  if (!m) return null;
  return methodKeyFromLabel(m[1].trim());
}

// Booking activities — the dimension slot capacity is now capped on.
export const SLOT_ACTIVITIES = ["send", "receive"] as const;
export type SlotActivity = (typeof SLOT_ACTIVITIES)[number];

// Canonical Thai labels for each activity, shown to the customer and stored
// in the "จองคิว: ..." note segment. Single source of truth so the booking
// route (which writes them) and note parsing (which reads them back for
// usage counts) can never drift apart.
export const ACTIVITY_LABELS: Record<SlotActivity, string> = {
  send: "ส่งเสื้อผ้าซัก",
  receive: "รับเสื้อผ้าที่เสร็จคืน (+ส่งเสื้อผ้าใหม่)",
};

// Map a stored activity label back to its key. Uses substring matching so a
// trailing " (orderId)" left on the note segment doesn't defeat the lookup,
// and checks `receive` first since its label also contains "ส่งเสื้อผ้า".
export function activityKeyFromLabel(label: string): SlotActivity | null {
  if (label.includes("รับเสื้อผ้าที่เสร็จคืน")) return "receive";
  if (label.includes("ส่งเสื้อผ้าซัก")) return "send";
  return null;
}

// The booking note carries "จองคิว: {activityLabel} (orderId) วันที่ ...".
// Pull the activity key back out so we can count how many bookings of each
// activity already occupy a slot.
export const NOTE_ACTIVITY_RE = /จองคิว:\s*(.+?)\s+วันที่/;

export function extractActivityFromNote(note: string | null): SlotActivity | null {
  if (!note) return null;
  const m = note.match(NOTE_ACTIVITY_RE);
  if (!m) return null;
  return activityKeyFromLabel(m[1]);
}

// Weekly shop closures. Stored on Settings.closedWeekdays as a JSON array of
// weekday indices (0 = Sunday … 6 = Saturday); empty/absent = open every day.
export function parseClosedWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((n) => typeof n === "number" && n >= 0 && n <= 6)
      : [];
  } catch {
    return [];
  }
}

// Weekday index (0 = Sunday) of a "YYYY-MM-DD" calendar date. Anchored at UTC
// midnight so it's timezone-independent — the calendar date's weekday is the
// same everywhere.
export function weekdayOfDateStr(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isDateClosed(date: string, closedWeekdays: number[]): boolean {
  return closedWeekdays.includes(weekdayOfDateStr(date));
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
