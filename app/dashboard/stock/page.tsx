"use client";

import { useState, useEffect, useCallback } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";

const CATEGORY_LABELS: Record<string, string> = {
  detergent: "ผงซักฟอก / น้ำยา",
  hangers: "ไม้แขวน",
  packaging: "บรรจุภัณฑ์",
  other: "อื่นๆ",
};

const CATEGORY_BADGE: Record<string, string> = {
  detergent: "bg-blue-100 text-blue-700",
  hangers: "bg-amber-100 text-amber-700",
  packaging: "bg-purple-100 text-purple-700",
  other: "bg-slate-100 text-slate-700",
};

interface StockItem {
  id: number;
  category: string;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  note: string | null;
}

const emptyItem: StockItem = {
  id: 0,
  category: "detergent",
  name: "",
  unit: "piece",
  quantity: 0,
  reorderLevel: 0,
  note: "",
};

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem>(emptyItem);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [adjusting, setAdjusting] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stock");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  const adjust = async (id: number, delta: number) => {
    setAdjusting(id);
    try {
      const res = await fetch(`/api/stock/${id}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) await load();
    } finally {
      setAdjusting(null);
    }
  };

  const handleSave = async () => {
    if (!editing.name.trim()) return;
    const url = isEdit ? `/api/stock/${editing.id}` : "/api/stock";
    const method = isEdit ? "PATCH" : "POST";
    const payload = isEdit
      ? {
          name: editing.name,
          unit: editing.unit,
          category: editing.category,
          reorderLevel: editing.reorderLevel,
          note: editing.note,
        }
      : editing;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await load();
      setModalOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/stock/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      setDeleteTarget(null);
    }
  };

  const openAdd = () => {
    setEditing({ ...emptyItem });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setEditing({ ...item, note: item.note || "" });
    setIsEdit(true);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">สต็อก</h2>
        <button onClick={openAdd} className="btn-primary">+ เพิ่มรายการ</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: "all", label: "ทั้งหมด" },
          ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCat(c.id)}
            className={`filter-tab ${filterCat === c.id ? "active" : ""}`}
          >
            {c.label} ({c.id === "all" ? items.length : items.filter((i) => i.category === c.id).length})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>ประเภท</th>
                <th className="text-right">คงเหลือ</th>
                <th className="text-right hide-mobile">จุดสั่งซื้อ</th>
                <th className="text-center">ปรับ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีรายการ</td></tr>
              ) : (
                filtered.map((item) => {
                  const low = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item.id} className={low ? "bg-red-50" : ""}>
                      <td>
                        <div className="font-medium">{item.name}</div>
                        {item.note && <div className="text-xs text-slate-400">{item.note}</div>}
                      </td>
                      <td>
                        <span className={`badge ${CATEGORY_BADGE[item.category] || "badge-gray"}`}>
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </td>
                      <td className={`text-right font-bold ${low ? "text-red-600" : "text-slate-700"}`}>
                        {item.quantity.toLocaleString()} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                      </td>
                      <td className="text-right text-slate-500 text-sm hide-mobile">{item.reorderLevel}</td>
                      <td className="text-center">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => adjust(item.id, -1)}
                            disabled={adjusting === item.id}
                            className="px-2 py-1 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                          >−1</button>
                          <button
                            onClick={() => adjust(item.id, 1)}
                            disabled={adjusting === item.id}
                            className="px-2 py-1 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                          >+1</button>
                          <button
                            onClick={() => {
                              const d = prompt("เพิ่ม/ลด จำนวน (ใส่ติดลบเพื่อหัก)");
                              if (d) adjust(item.id, Number(d));
                            }}
                            disabled={adjusting === item.id}
                            className="px-2 py-1 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                          >…</button>
                        </div>
                      </td>
                      <td className="text-center">
                        <button onClick={() => openEdit(item)} className="text-blue-500 hover:text-blue-700 text-sm mr-3">แก้ไข</button>
                        <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? "แก้ไขรายการ" : "เพิ่มรายการ"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อ</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="เช่น ผงซักฟอกสูตรเข้มข้น 5kg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ประเภท</label>
              <select
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">หน่วย</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                value={editing.unit}
                onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                placeholder="ขวด, ชิ้น, กก."
              />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">คงเหลือเริ่มต้น</label>
              <input
                type="number"
                step="any"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">จุดสั่งซื้อ (เตือนเมื่อต่ำกว่าหรือเท่ากับ)</label>
            <input
              type="number"
              step="any"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              value={editing.reorderLevel}
              onChange={(e) => setEditing({ ...editing, reorderLevel: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">หมายเหตุ</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              value={editing.note || ""}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button onClick={handleSave} disabled={!editing.name.trim()} className="flex-1 btn-primary py-2.5 disabled:opacity-50">บันทึก</button>
          </div>
        </div>
      </Modal>

      <ConfirmDelete isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.name || ""} />
    </div>
  );
}
