"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "@/components/Spinner";
import { SLOT_TIMES, SLOT_METHODS, type SlotMethod } from "@/lib/booking-slots";

type CapRow = { time: string; method: string; capacity: number };

// Client-side cell value:
//  - "" means "unlimited" (row not stored)
//  - "0" means "closed" (row stored with capacity 0)
//  - any positive integer string means "cap N"
type CapMap = Record<string, Record<SlotMethod, string>>;

const METHOD_META: Record<SlotMethod, { label: string; icon: string }> = {
  home: { label: "ฝากที่พัก", icon: "🏠" },
  self: { label: "รับที่ร้าน", icon: "🏪" },
};

function emptyCapMap(): CapMap {
  const out: CapMap = {};
  for (const t of SLOT_TIMES) out[t] = { home: "", self: "" };
  return out;
}

export default function BookingSlotsPage() {
  const [caps, setCaps] = useState<CapMap>(emptyCapMap());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/booking-slots");
      if (!res.ok) return;
      const rows: CapRow[] = await res.json();
      const next = emptyCapMap();
      for (const r of rows) {
        if (!next[r.time]) continue;
        if (r.method === "home" || r.method === "self") {
          next[r.time][r.method] = String(r.capacity);
        }
      }
      setCaps(next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setCell = (time: string, method: SlotMethod, value: string) => {
    setCaps((prev) => ({
      ...prev,
      [time]: { ...prev[time], [method]: value },
    }));
  };

  const bulkFill = (method: SlotMethod, value: string) => {
    setCaps((prev) => {
      const next: CapMap = { ...prev };
      for (const t of SLOT_TIMES) next[t] = { ...next[t], [method]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const items: { time: string; method: string; capacity: number | null }[] = [];
      for (const t of SLOT_TIMES) {
        for (const m of SLOT_METHODS) {
          const raw = caps[t]?.[m] ?? "";
          if (raw === "") {
            items.push({ time: t, method: m, capacity: null }); // delete row
          } else {
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n < 0) continue;
            items.push({ time: t, method: m, capacity: n });
          }
        }
      }
      const res = await fetch("/api/booking-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        await load();
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

  return (
    <div>
      {saving && <Spinner text="กำลังบันทึก..." />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">จำนวนสล็อตต่อเวลา</h2>
        <button onClick={handleSave} disabled={loading || saving} className="btn-primary">
          บันทึก
        </button>
      </div>

      <div className="card mb-4 text-sm text-slate-600 leading-6">
        <p>ตั้งจำนวนคิวสูงสุดต่อช่วงเวลา แยกตามวิธีรับ-ส่ง</p>
        <ul className="list-disc pl-5 mt-1">
          <li>ปล่อยว่าง = ไม่จำกัด</li>
          <li><span className="font-mono">0</span> = ปิดสล็อตนี้ ลูกค้าจะเลือกไม่ได้</li>
        </ul>
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
                  {SLOT_METHODS.map((m) => (
                    <th key={m} className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span>{METHOD_META[m].icon}</span>
                        <span>{METHOD_META[m].label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="text-left text-xs text-slate-400 font-normal">ตั้งค่ารวม →</th>
                  {SLOT_METHODS.map((m) => (
                    <th key={m} className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          placeholder="N"
                          className="w-16 px-2 py-1 rounded border border-slate-300 text-xs text-center"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              bulkFill(m, (e.target as HTMLInputElement).value);
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
                    {SLOT_METHODS.map((m) => {
                      const value = caps[t]?.[m] ?? "";
                      const closed = value === "0";
                      return (
                        <td key={m} className="text-center">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => setCell(t, m, e.target.value)}
                            placeholder="ไม่จำกัด"
                            className={`w-24 px-2 py-1 rounded border text-sm text-center ${
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
