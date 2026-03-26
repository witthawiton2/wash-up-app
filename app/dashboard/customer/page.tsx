"use client";

import { useState, useEffect, useCallback } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";

interface Customer {
  id: number;
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  package: string;
  endDate: string;
  remaining: number;
  lineUserId: string;
  status: string;
  renewPending: boolean;
  renewSlipUrl: string;
}

interface PackageOption {
  id: number;
  name: string;
  description: string;
  totalItems: number;
  validDays: number;
  price: number;
}

const emptyCustomer: Customer = { id: 0, customerCode: "", name: "", phone: "", address: "", package: "", endDate: "", remaining: 0, lineUserId: "", status: "approved", renewPending: false, renewSlipUrl: "" };

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer>(emptyCustomer);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [renewTarget, setRenewTarget] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      }
    } catch (error) {
      console.error("Failed to fetch packages:", error);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchPackages();
  }, [fetchCustomers, fetchPackages]);

  const openAdd = () => {
    setEditing({ ...emptyCustomer });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing({ ...c });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSelectPackage = (pkgName: string) => {
    const pkg = packages.find((p) => p.name === pkgName);
    if (pkg) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + pkg.validDays);
      const endDateStr = `${String(endDate.getDate()).padStart(2, "0")}/${String(endDate.getMonth() + 1).padStart(2, "0")}/${endDate.getFullYear()}`;
      setEditing({
        ...editing,
        package: pkgName,
        remaining: pkg.totalItems,
        endDate: endDateStr,
      });
    } else {
      setEditing({ ...editing, package: pkgName });
    }
  };

  const handleApprove = async (c: Customer) => {
    try {
      const res = await fetch("/api/customers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, type: "approve" }),
      });
      if (res.ok) {
        await fetchCustomers();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleRenewConfirm = async () => {
    if (!renewTarget) return;
    try {
      const res = await fetch("/api/customers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renewTarget.id, type: "renew" }),
      });
      if (res.ok) {
        await fetchCustomers();
        setRenewTarget(null);
      }
    } catch (error) {
      console.error("Failed to renew:", error);
    }
  };

  const handleSave = async () => {
    try {
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch("/api/customers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? editing.id : undefined,
          customerCode: editing.customerCode,
          name: editing.name,
          phone: editing.phone,
          address: editing.address,
          package: editing.package,
          endDate: editing.endDate,
          remaining: editing.remaining,
          lineUserId: editing.lineUserId,
        }),
      });
      if (res.ok) {
        await fetchCustomers();
        setModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/customers?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchCustomers();
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const selectedPkg = packages.find((p) => p.name === editing.package);

  const pendingCount = customers.filter((c) => c.status === "pending" || c.renewPending).length;

  const tabs = [
    { label: "ทั้งหมด", count: customers.length },
    { label: "รอยืนยัน", count: pendingCount },
  ];

  const filteredCustomers = (() => {
    let list = activeTab === "รอยืนยัน"
      ? customers.filter((c) => c.status === "pending" || c.renewPending)
      : customers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        (c.customerCode || "").toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address || "").toLowerCase().includes(q)
      );
    }
    return list;
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Customer</h2>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มลูกค้าใหม่</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.label}
            onClick={() => setActiveTab(t.label)}
            className={`filter-tab ${activeTab === t.label ? "active" : ""}`}
          >
            {t.label} {t.count > 0 ? `(${t.count})` : ""}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="ค้นหา ชื่อ / เบอร์โทร / รหัสลูกค้า..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>เบอร์โทร</th>
                <th>ที่อยู่</th>
                <th className="hide-mobile">LINE User ID</th>
                <th>แพคเกจ</th>
                <th className="hide-mobile">วันหมดอายุ</th>
                <th className="text-right">ยอดคงเหลือ</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">กำลังโหลด...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">ยังไม่มีลูกค้า</td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      {c.name}
                      {c.status === "pending" && <span className="badge badge-yellow ml-1">รอยืนยัน</span>}
                      {c.renewPending && <span className="badge badge-red ml-1">รอเติมแพ็คเกจ</span>}
                    </td>
                    <td className="text-slate-500">{c.phone}</td>
                    <td className="text-slate-500">{c.address}</td>
                    <td className="text-slate-500 text-xs font-mono hide-mobile">{c.lineUserId ? c.lineUserId.slice(0, 10) + "..." : <span className="text-slate-300">-</span>}</td>
                    <td><span className="badge badge-blue">{c.package || "-"}</span></td>
                    <td className="text-slate-500 hide-mobile">{c.endDate}</td>
                    <td className="text-right font-medium">
                      <span className={c.remaining === 0 ? "text-red-500" : "text-green-600"}>{c.remaining} ชิ้น</span>
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {c.status === "pending" && (
                        <button onClick={() => handleApprove(c)} className="text-green-600 hover:text-green-800 text-sm mr-2 font-medium">ยืนยัน</button>
                      )}
                      {c.renewPending && (
                        <button onClick={() => setRenewTarget(c)} className="text-orange-600 hover:text-orange-800 text-sm mr-2 font-medium">🧾 ตรวจสอบ</button>
                      )}
                      <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 text-sm mr-2">แก้ไข</button>
                      <button onClick={() => setDeleteTarget(c)} className="text-red-500 hover:text-red-700 text-sm">ลบ</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isEdit ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">รหัสลูกค้า</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.customerCode} onChange={(e) => setEditing({ ...editing, customerCode: e.target.value })} placeholder="เช่น C001, VIP-01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อ</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">เบอร์โทร</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ที่อยู่</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">LINE User ID</label>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.lineUserId} onChange={(e) => setEditing({ ...editing, lineUserId: e.target.value })} placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">แพคเกจ</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.package}
              onChange={(e) => handleSelectPackage(e.target.value)}
            >
              <option value="">-- ไม่มีแพ็คเกจ --</option>
              {packages.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} — {p.totalItems} ชิ้น / {p.validDays} วัน ({p.price.toLocaleString()}฿)
                </option>
              ))}
            </select>
            {selectedPkg && (
              <p className="text-xs text-slate-400 mt-1">
                {selectedPkg.description}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">วันหมดอายุ</label>
              <input className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} placeholder="DD/MM/YYYY" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ยอดคงเหลือ (ชิ้น)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editing.remaining} onChange={(e) => setEditing({ ...editing, remaining: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button onClick={handleSave} className="flex-1 btn-primary py-2.5">บันทึก</button>
          </div>
        </div>
      </Modal>

      <ConfirmDelete isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.name || ""} />

      {/* Modal: ตรวจสอบเติมแพ็คเกจ */}
      <Modal isOpen={!!renewTarget} onClose={() => setRenewTarget(null)} title="ตรวจสอบคำขอเติมแพ็คเกจ">
        {renewTarget && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm font-medium text-slate-700">{renewTarget.name}</p>
              <p className="text-xs text-slate-400">{renewTarget.phone}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-slate-500">แพ็คเกจ: <span className="font-medium text-blue-600">{renewTarget.package}</span></span>
                <span className={`font-medium ${renewTarget.remaining <= 0 ? "text-red-500" : "text-green-600"}`}>เหลือ {renewTarget.remaining} ชิ้น</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">หมดอายุ: {renewTarget.endDate}</p>
            </div>

            {renewTarget.renewSlipUrl ? (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">สลิปการโอนเงิน</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={renewTarget.renewSlipUrl} alt="slip" className="w-full rounded-lg border" />
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
                ไม่มีสลิปแนบมา
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setRenewTarget(null)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">ปิด</button>
              <button onClick={handleRenewConfirm} className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium bg-green-500 hover:bg-green-600">ยืนยันเติมแพ็คเกจ</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
