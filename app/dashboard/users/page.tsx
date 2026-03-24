"use client";

import { useState, useEffect, useCallback } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  active: boolean;
}

const roles = [
  { value: "admin", label: "ผู้จัดการ" },
  { value: "staff", label: "พนง.ทั่วไป" },
  { value: "driver", label: "พนง.รับส่ง" },
];

const roleLabelMap: Record<string, string> = {
  admin: "ผู้จัดการ",
  staff: "พนง.ทั่วไป",
  driver: "พนง.รับส่ง",
};

const roleBadgeMap: Record<string, string> = {
  admin: "badge-blue",
  staff: "badge-green",
  driver: "badge-yellow",
};

const emptyUser = {
  id: 0,
  username: "",
  password: "",
  name: "",
  role: "staff",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(emptyUser);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAdd = () => {
    setEditing({ ...emptyUser });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing({ id: u.id, username: u.username, password: "", name: u.name, role: u.role });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing.username.trim() || !editing.name.trim()) return;
    if (!isEdit && !editing.password.trim()) return;

    try {
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        id: isEdit ? editing.id : undefined,
        username: editing.username,
        name: editing.name,
        role: editing.role,
      };
      if (editing.password) body.password = editing.password;

      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchUsers();
        setModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Failed to save user:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/users?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchUsers();
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      });
      if (res.ok) await fetchUsers();
    } catch (error) {
      console.error("Failed to toggle user:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">User</h2>
        <button className="btn-primary" onClick={openAdd}>
          + เพิ่มผู้ใช้
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>ชื่อ-นามสกุล</th>
                <th>ตำแหน่ง</th>
                <th className="text-center">สถานะ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    ยังไม่มีผู้ใช้
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={!u.active ? "opacity-50" : ""}>
                    <td className="font-medium font-mono">{u.username}</td>
                    <td>{u.name}</td>
                    <td>
                      <span className={`badge ${roleBadgeMap[u.role] || "badge-gray"}`}>
                        {roleLabelMap[u.role] || u.role}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          u.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {u.active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </button>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-blue-500 hover:text-blue-700 text-sm mr-3"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
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
        title={isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ชื่อผู้ใช้ (username)
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.username}
              onChange={(e) =>
                setEditing({ ...editing, username: e.target.value })
              }
              disabled={isEdit}
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {isEdit ? "รหัสผ่าน (เว้นว่างถ้าไม่ต้องการเปลี่ยน)" : "รหัสผ่าน"}
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.password}
              onChange={(e) =>
                setEditing({ ...editing, password: e.target.value })
              }
              placeholder={isEdit ? "••••••••" : "รหัสผ่าน"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ชื่อ-นามสกุล
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
              placeholder="ชื่อ-นามสกุล"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ตำแหน่ง
            </label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.role}
              onChange={(e) =>
                setEditing({ ...editing, role: e.target.value })
              }
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
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
              disabled={!editing.username.trim() || !editing.name.trim()}
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
