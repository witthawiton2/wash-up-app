"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "@/components/Spinner";
import { SLOT_TIMES, SLOT_ACTIVITIES, type SlotActivity } from "@/lib/booking-slots";
import { useRequireAdmin } from "@/lib/use-require-admin";

type CapRow = { time: string; activity: string; capacity: number };

// Client-side cell value:
//  - "" means "unlimited" in default mode, or "inherit default" in override mode
//  - "0" means "closed"
//  - any positive integer string means "cap N"
type CapMap = Record<string, Record<SlotActivity, string>>;

const ACTIVITY_META: Record<SlotActivity, { label: string; icon: string }> = {
  send: { label: "ส่งเสื้อผ้าซัก", icon: "🧺" },
  receive: { label: "รับเสื้อผ้าคืน", icon: "👕" },
};

// Weekday labels indexed 0=Sunday … 6=Saturday, matching JS getUTCDay().
const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function emptyCapMap(): CapMap {
  const out: CapMap = {};
  for (const t of SLOT_TIMES) out[t] = { send: "", receive: "" };
  return out;
}

function rowsToCapMap(rows: CapRow[]): CapMap {
  const next = emptyCapMap();
  for (const r of rows) {
    if (!next[r.time]) continue;
    if (r.activity === "send" || r.activity === "receive") {
      next[r.time][r.activity] = String(r.capacity);
    }
  }
  return next;
}

export default function BookingSlotsPage() {
  useRequireAdmin();
  const [caps, setCaps] = useState<CapMap>(emptyCapMap());
  const [defaults, setDefaults] = useState<CapMap>(emptyCapMap());
  const [editDate, setEditDate] = useState(""); // "" = default (every day)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [closedDays, setClosedDays] = useState<number[]>([]);
  const [savingDays, setSavingDays] = useState(false);
  const [daysSaved, setDaysSaved] = useState(false);

  const isOverride = editDate !== "";

  // Load the shop's weekly closed days (stored on Settings.closedWeekdays).
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.closedWeekdays) return;
        try {
          const arr = JSON.parse(d.closedWeekdays);
          if (Array.isArray(arr)) setClosedDays(arr.filter((n) => typeof n === "number"));
        } catch { /* ignore malformed */ }
      })
      .catch(() => {});
  }, []);

  const toggleClosedDay = (dow: number) => {
    setDaysSaved(false);
    setClosedDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b)
    );
  };

  const saveClosedDays = async () => {
    if (savingDays) return;
    setSavingDays(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closedWeekdays: JSON.stringify(closedDays) }),
      });
      if (res.ok) setDaysSaved(true);
      else alert("บันทึกวันหยุดไม่สำเร็จ");
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSavingDays(false);
    }
  };

  const fetchCaps = useCallback(async (date: string): Promise<CapMap> => {
    const res = await fetch(`/api/booking-slots?date=${encodeURIComponent(date)}`);
    if (!res.ok) return emptyCapMap();
    const rows: CapRow[] = await res.json();
    return rowsToCapMap(rows);
  }, []);

  const load = useCallback(
    async (date: string) => {
      setLoading(true);
      setSavedAt(null);
      try {
        // In override mode also pull the defaults so cells can show what the
        // day would fall back to when left blank.
        const [cur, def] = await Promise.all([
          fetchCaps(date),
          date === "" ? Promise.resolve<CapMap | null>(null) : fetchCaps(""),
        ]);
        setCaps(cur);
        if (date === "") setDefaults(cur);
        else if (def) setDefaults(def);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [fetchCaps]
  );

  useEffect(() => {
    load(editDate);
  }, [editDate, load]);

  const setCell = (time: string, activity: SlotActivity, value: string) => {
    setCaps((prev) => ({
      ...prev,
      [time]: { ...prev[time], [activity]: value },
    }));
  };

  const bulkFill = (activity: SlotActivity, value: string) => {
    setCaps((prev) => {
      const next: CapMap = { ...prev };
      for (const t of SLOT_TIMES) next[t] = { ...next[t], [activity]: value };
      return next;
    });
  };

  const clearAll = () => {
    setCaps(emptyCapMap());
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const items: { time: string; activity: string; capacity: number | null }[] = [];
      for (const t of SLOT_TIMES) {
        for (const a of SLOT_ACTIVITIES) {
          const raw = caps[t]?.[a] ?? "";
          if (raw === "") {
            items.push({ time: t, activity: a, capacity: null }); // delete row
          } else {
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n < 0) continue;
            items.push({ time: t, activity: a, capacity: n });
          }
        }
      }
      const res = await fetch("/api/booking-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDate, items }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        await load(editDate);
      } else {
        alert("บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  // Placeholder shown when a cell is blank — differs by mode.
  const placeholderFor = (time: string, activity: SlotActivity): string => {
    if (!isOverride) return "ไม่จำกัด";
    const d = defaults[time]?.[activity] ?? "";
    if (d === "") return "ตามค่าเริ่มต้น (ไม่จำกัด)";
    if (d === "0") return "ตามค่าเริ่มต้น (ปิด)";
    return `ตามค่าเริ่มต้น (${d})`;
  };

  return (
    <div>
      {saving && <Spinner text="กำลังบันทึก..." />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">จำนวนสล็อตต่อเวลา</h2>
        <button onClick={handleSave} disabled={loading || saving} className="btn-primary">
          บันทึก
        </button>
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">วันเปิด-ปิดร้าน (ประจำสัปดาห์)</label>
          <button
            onClick={saveClosedDays}
            disabled={savingDays}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {savingDays ? "กำลังบันทึก..." : "บันทึกวันหยุด"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, dow) => {
            const isClosed = closedDays.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => toggleClosedDay(dow)}
                className={`w-11 h-11 rounded-lg text-sm font-semibold border transition-colors ${
                  isClosed
                    ? "bg-red-50 border-red-300 text-red-600"
                    : "bg-green-50 border-green-300 text-green-700"
                }`}
                title={isClosed ? "ปิด (กดเพื่อเปิด)" : "เปิด (กดเพื่อปิด)"}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          🟢 เปิด · 🔴 ปิด — วันที่ปิดลูกค้าจะจองคิวไม่ได้ทั้งวัน
          {daysSaved && <span className="text-emerald-600 ml-2">บันทึกแล้ว</span>}
        </p>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">แก้ไขสำหรับ:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setEditDate("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                !isOverride
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              ค่าเริ่มต้น (ทุกวัน)
            </button>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
              title="เลือกวันเพื่อตั้งค่าเฉพาะวันนั้น (วันหยุด/วันพีค)"
            />
            {isOverride && (
              <button
                onClick={clearAll}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 bg-red-50 text-red-600"
                title="ล้างทุกช่อง — วันนี้จะกลับไปใช้ค่าเริ่มต้น"
              >
                ล้างทั้งวัน (ใช้ค่าเริ่มต้น)
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-4 text-sm text-slate-600 leading-6">
        {isOverride ? (
          <>
            <p>
              กำลังตั้งค่าเฉพาะวันที่ <span className="font-semibold text-slate-800">{editDate}</span> —
              มีผลเฉพาะวันนี้ ทับค่าเริ่มต้น
            </p>
            <ul className="list-disc pl-5 mt-1">
              <li>ปล่อยว่าง = ใช้ค่าเริ่มต้นของช่วงเวลานั้น</li>
              <li><span className="font-mono">0</span> = ปิดสล็อตนี้เฉพาะวันนี้</li>
            </ul>
          </>
        ) : (
          <>
            <p>ตั้งจำนวนคิวสูงสุดต่อช่วงเวลา แยกตามกิจกรรม (ส่งเสื้อผ้าซัก / รับเสื้อผ้าคืน) ใช้กับทุกวัน</p>
            <ul className="list-disc pl-5 mt-1">
              <li>ปล่อยว่าง = ไม่จำกัด</li>
              <li><span className="font-mono">0</span> = ปิดสล็อตนี้ ลูกค้าจะเลือกไม่ได้</li>
              <li>ต้องการตั้งค่าเฉพาะวันหยุด/วันพีค เลือกวันที่ด้านบน</li>
            </ul>
          </>
        )}
        {savedAt && (
          <p className="mt-2 text-emerald-600 text-xs">บันทึกเรียบร้อย</p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">เวลา</th>
                  {SLOT_ACTIVITIES.map((a) => (
                    <th key={a} className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span>{ACTIVITY_META[a].icon}</span>
                        <span>{ACTIVITY_META[a].label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="text-left text-xs text-slate-400 font-normal">ตั้งค่ารวม →</th>
                  {SLOT_ACTIVITIES.map((a) => (
                    <th key={a} className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          placeholder="N"
                          className="w-16 px-2 py-1 rounded border border-slate-300 text-xs text-center"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              bulkFill(a, (e.target as HTMLInputElement).value);
                            }
                          }}
                        />
                        <span className="text-[10px] text-slate-400">Enter = ใส่ทุกแถว</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOT_TIMES.map((t) => (
                  <tr key={t}>
                    <td className="font-mono text-slate-700">{t}</td>
                    {SLOT_ACTIVITIES.map((a) => {
                      const value = caps[t]?.[a] ?? "";
                      const closed = value === "0";
                      return (
                        <td key={a} className="text-center">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => setCell(t, a, e.target.value)}
                            placeholder={placeholderFor(t, a)}
                            className={`w-40 px-2 py-1 rounded border text-sm text-center ${
                              closed
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-slate-300"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
