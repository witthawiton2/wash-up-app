"use client";

import { useState, useEffect, useCallback } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";

interface ServiceItem {
  id: number;
  name: string;
  price: number;
  category: string;
  note: string;
  inPackage: boolean;
  packageDeduction: number;
}

const categories = ["รายการในแพ็คเกจ", "รายการซักอบรีด", "รายการซักแห้ง", "รายการรีดอย่างเดียว", "ซัก อบ พับ"];
const categoryBadge: Record<string, string> = {
  "รายการในแพ็คเกจ": "badge-blue",
  "รายการซักอบรีด": "badge-blue",
  "รายการซักแห้ง": "badge-green",
  "รายการรีดอย่างเดียว": "badge-yellow",
  "ซัก อบ พับ": "badge-gray",
};

const emptyItem: ServiceItem = {
  id: 0,
  name: "",
  price: 0,
  category: "รายการซักอบรีด",
  note: "",
  inPackage: false,
  packageDeduction: 1,
};

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem>(emptyItem);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [filterCat, setFilterCat] = useState("ทั้งหมด");

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/service-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch service items:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = filterCat === "ทั้งหมด" ? items : items.filter((i) => i.category === filterCat);

  const openAdd = () => {
    setEditing({ ...emptyItem });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (item: ServiceItem) => {
    setEditing({ ...item });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing.name.trim()) return;
    try {
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch("/api/service-items", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? editing.id : undefined,
          name: editing.name,
          price: editing.price,
          category: editing.category,
          note: editing.note,
          inPackage: editing.inPackage,
          packageDeduction: editing.packageDeduction,
        }),
      });
      if (res.ok) {
        await fetchItems();
        setModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to save service item:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/service-items?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchItems();
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to delete service item:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">รายการสินค้า / บริการ</h2>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มรายการ</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["ทั้งหมด", ...categories].map((c) => (
          <button key={c} onClick={() => setFilterCat(c)} className={`filter-tab ${filterCat === c ? "active" : ""}`}>
            {c} {c !== "ทั้งหมด" ? `(${items.filter((i) => i.category === c).length})` : `(${items.length})`}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th className="text-right">ราคา (฿)</th>
                <th>ประเภท</th>
                <th className="hide-mobile">หมายเหตุ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">ยังไม่มีรายการ</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td className="text-right">{item.price.toLocaleString()}</td>
                    <td><span className={`badge ${categoryBadge[item.category] || "badge-gray"}`}>{item.category}</span></td>
                    <td className="text-slate-500 text-xs hide-mobile">{item.note || "-"}</td>
                    <td className="text-center">
                      <button onClick={() => openEdit(item)} className="text-blue-500 hover:text-blue-700 text-sm mr-3">แก้ไข</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อรายการ</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="เช่น เสื้อ, กางเกง" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ราคา (฿)</label>
            <input type="number" min={0} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ประเภท</label>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">หมายเหตุ</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="หมายเหตุ (ถ้ามี)" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editing.inPackage} onChange={(e) => setEditing({ ...editing, inPackage: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-slate-600">อยู่ในแพ็คเกจ</span>
            </label>
          </div>
          {editing.inPackage && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ตัดแพ็คเกจกี่ชิ้น</label>
              <input type="number" min={1} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.packageDeduction} onChange={(e) => setEditing({ ...editing, packageDeduction: Number(e.target.value) })} />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button onClick={handleSave} disabled={!editing.name.trim()} className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">บันทึก</button>
          </div>
        </div>
      </Modal>

      <ConfirmDelete isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.name || ""} />
    </div>
  );
}
