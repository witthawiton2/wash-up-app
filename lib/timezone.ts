const TZ = "Asia/Bangkok";

export function formatDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  });
}

export function nowBangkok(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function todayStart(): Date {
  const d = nowBangkok();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayEnd(): Date {
  const d = nowBangkok();
  d.setHours(23, 59, 59, 999);
  return d;
}
