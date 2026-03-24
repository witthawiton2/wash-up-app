"use client";

import { useState, useEffect, useCallback } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";

interface Package {
  id: number;
  name: string;
  description: string;
  totalItems: number;
  validDays: number;
  price: number;
}

const emptyPkg: Package = {
  id: 0,
  name: "",
  description: "",
  totalItems: 0,
  validDays: 60,
  price: 0,
};

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Package>(emptyPkg);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      }
    } catch (error) {
      console.error("Failed to fetch packages:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const openAdd = () => {
    setEditing({ ...emptyPkg });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (pkg: Package) => {
    setEditing({ ...pkg });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing.name.trim() || !editing.totalItems || !editing.validDays) return;
    try {
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch("/api/packages", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? editing.id : undefined,
          name: editing.name,
          description: editing.description,
          totalItems: editing.totalItems,
          validDays: editing.validDays,
          price: editing.price,
        }),
      });
      if (res.ok) {
        await fetchPackages();
        setModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to save package:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/packages?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPackages();
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to delete package:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">แพ็คเกจ</h2>
        <button className="btn-primary" onClick={openAdd}>
          + เพิ่มแพ็คเกจ
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อแพ็คเกจ</th>
                <th>รายละเอียด</th>
                <th className="text-right">จำนวนชิ้น</th>
                <th className="text-right">อายุ (วัน)</th>
                <th className="text-right">ราคา (฿)</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    ยังไม่มีแพ็คเกจ
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="font-medium">{pkg.name}</td>
                    <td className="text-slate-500">{pkg.description || "-"}</td>
                    <td className="text-right">{pkg.totalItems}</td>
                    <td className="text-right">{pkg.validDays}</td>
                    <td className="text-right font-medium">
                      {pkg.price.toLocaleString()}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => openEdit(pkg)}
                        className="text-blue-500 hover:text-blue-700 text-sm mr-3"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pkg)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEdit ? "แก้ไขแพ็คเกจ" : "เพิ่มแพ็คเกจใหม่"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ชื่อแพ็คเกจ
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
              placeholder="เช่น S, M, L"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              รายละเอียด
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.description}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
              placeholder="เช่น 5 items within 15 days"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                จำนวนชิ้น
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.totalItems}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    totalItems: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                อายุ (วัน)
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.validDays}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    validDays: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                ราคา (฿)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.price}
                onChange={(e) =>
                  setEditing({ ...editing, price: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={!editing.name.trim()}
              className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              บันทึก
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDelete
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.name || ""}
      />
    </div>
  );
}
