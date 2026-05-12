"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal, { ConfirmDelete } from "@/components/Modal";
import Spinner from "@/components/Spinner";
import Pagination, { usePagination } from "@/components/Pagination";
import { usePolling } from "@/lib/use-polling";

interface LaundryItem {
  name: string;
  qty: number;
  price: number;
  svcId?: number;
}

interface LaundryOrder {
  id: number;
  orderId: string;
  customerId: number;
  customer: string;
  phone: string;
  address: string;
  lineUserId: string;
  items: LaundryItem[];
  status: string;
  totalAmount: number;
  hangersOwned: number;
  hangersBought: number;
  discount: number;
  checkPhotos: string | null;
  note: string;
  date: string;
}

interface CustomerOption {
  id: number;
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  lineUserId: string;
  remaining: number;
  package: string;
}

interface ServiceItemOption {
  id: number;
  name: string;
  nameEn: string | null;
  price: number;
  category: string;
  inPackage: boolean;
  packageDeduction: number;
}

const filters = ["ทั้งหมด", "รอซักรีด", "พร้อมส่ง"];
const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "กำลังจัดส่ง": "badge-yellow",
  "ส่งแล้ว": "badge-gray",
};

const emptyItem: LaundryItem = { name: "", qty: 1, price: 0 };

const calcTotal = (items: LaundryItem[]) =>
  items.reduce((s, i) => s + i.qty * i.price, 0);
const calcQty = (items: LaundryItem[]) =>
  items.reduce((s, i) => s + i.qty, 0);

export default function LaundryPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<{
    orderId: string;
    customerId: number;
    items: LaundryItem[];
    walkInName: string;
    hangersOwned: number;
    hangersBought: number;
    discount: number;
    checkPhotos: string[];
    note: string;
  }>({ orderId: "", customerId: 0, walkInName: "", items: [{ ...emptyItem }], hangersOwned: 0, hangersBought: 0, discount: 0, checkPhotos: [], note: "" });
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewCheckPhotos, setViewCheckPhotos] = useState<string[] | null>(null);
  const checkPhotoRef = useRef<HTMLInputElement>(null);
  const [originalItems, setOriginalItems] = useState<LaundryItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LaundryOrder | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Record<number, string>>({});
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("washup_auto_print");
    if (saved === "true") setAutoPrint(true);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?days=90&limit=500");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  }, []);

  const fetchServiceItems = useCallback(async () => {
    try {
      const res = await fetch("/api/service-items");
      if (res.ok) {
        const data = await res.json();
        setServiceItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch service items:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchCustomers(), fetchServiceItems()]);
  }, [fetchOrders, fetchCustomers, fetchServiceItems]);

  usePolling(fetchOrders, 30000);

  const handleSelectServiceItem = (index: number, idStr: string) => {
    const svc = serviceItems.find((s) => s.id === Number(idStr));
    const custHasPackage = selectedCustomer?.package && selectedCustomer.remaining > 0;
    const isFreeInPackage = svc?.inPackage && custHasPackage;
    const price = isFreeInPackage ? 0 : (svc?.price || 0);
    const newItems = editing.items.map((item, i) =>
      i === index
        ? { ...item, name: svc?.name || "", price, svcId: svc?.id }
        : item
    );
    setEditing({ ...editing, items: newItems });
  };

  const filtered = (() => {
    let list = activeFilter === "ทั้งหมด"
      ? orders
      : orders.filter((o) => o.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o) =>
        o.orderId.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        (o.phone || "").includes(q)
      );
    }
    return list;
  })();

  const { paged, currentPage, totalPages, totalItems, itemsPerPage, setCurrentPage } = usePagination(filtered, 20);

  const generateOrderId = () => {
    const maxNum = orders.reduce((max, o) => {
      const num = parseInt(o.orderId.replace(/\D/g, ""));
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return String(maxNum + 1).padStart(6, "0");
  };

  const openAdd = () => {
    setEditing({
      orderId: generateOrderId(),
      customerId: 0,
      walkInName: "",
      items: [{ ...emptyItem }],
      hangersOwned: 0,
      hangersBought: 0,
      discount: 0,
      checkPhotos: [],
      note: "",
    });
    setOriginalItems([]);
    setEditingOrderId(null);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setSelectedCategory({});
    setModalOpen(true);
  };

  const openEdit = (o: LaundryOrder) => {
    const photos: string[] = [];
    if (o.checkPhotos) {
      try { photos.push(...JSON.parse(o.checkPhotos)); } catch { /* ignore */ }
    }
    setEditing({
      orderId: o.orderId,
      customerId: o.customerId,
      walkInName: "",
      items: o.items.map((i) => ({ ...i })),
      hangersOwned: o.hangersOwned,
      hangersBought: o.hangersBought,
      discount: o.discount || 0,
      checkPhotos: photos,
      note: o.note,
    });
    setOriginalItems(o.items.map((i) => ({ ...i })));
    setCustomerSearch(o.customer);
    setShowCustomerDropdown(false);
    setEditingOrderId(o.orderId);
    // Auto-select category for each existing item
    const catMap: Record<number, string> = {};
    o.items.forEach((item, idx) => {
      if (item.svcId) {
        const svc = serviceItems.find((s) => s.id === item.svcId);
        if (svc) catMap[idx] = svc.category;
      }
    });
    setSelectedCategory(catMap);
    setModalOpen(true);
  };

  const updateItem = (
    index: number,
    field: keyof LaundryItem,
    value: string | number
  ) => {
    const newItems = editing.items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setEditing({ ...editing, items: newItems });
  };

  const addItem = () => {
    setEditing({
      ...editing,
      items: [...editing.items, { ...emptyItem }],
    });
  };

  const removeItem = (index: number) => {
    if (editing.items.length <= 1) return;
    setEditing({
      ...editing,
      items: editing.items.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (saving) return;
    const cleanedItems = editing.items.filter((i) => i.name.trim() !== "");
    if (cleanedItems.length === 0) return;
    const walkIn = editing.customerId ? "" : customerSearch.trim();
    if (!editing.customerId && !walkIn) return;

    setSaving(true);
    try {
      if (editingOrderId) {
        // Edit existing
        const res = await fetch("/api/orders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: editingOrderId,
            items: cleanedItems,
            hangersOwned: editing.hangersOwned,
            hangersBought: editing.hangersBought,
            discount: editing.discount,
            checkPhotos: editing.checkPhotos.length > 0 ? JSON.stringify(editing.checkPhotos) : null,
            note: editing.note,
          }),
        });
        if (res.ok) {
          await Promise.all([fetchOrders(), fetchCustomers()]);
          setModalOpen(false);
          // Auto send LINE after edit
          const editedOrder = orders.find((o) => o.orderId === editingOrderId);
          if (editedOrder?.lineUserId) {
            fetch("/api/line/send-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: editingOrderId,
                lineUserId: editedOrder.lineUserId,
                edited: true,
              }),
            }).catch(() => {});
          }
        }
      } else {
        // Create new
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: editing.orderId,
            customerId: editing.customerId || undefined,
            walkInName: editing.customerId ? undefined : walkIn,
            items: cleanedItems,
            hangersOwned: editing.hangersOwned,
            hangersBought: editing.hangersBought,
            discount: editing.discount,
            checkPhotos: editing.checkPhotos.length > 0 ? JSON.stringify(editing.checkPhotos) : null,
            note: editing.note,
          }),
        });
        if (res.ok) {
          await Promise.all([fetchOrders(), fetchCustomers()]);
          setModalOpen(false);

          // Auto send LINE
          const cust = editing.customerId ? customers.find((c) => c.id === editing.customerId) : null;
          if (cust?.lineUserId) {
            fetch("/api/line/send-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: editing.orderId,
                lineUserId: cust.lineUserId,
              }),
            }).catch(() => {});
          }

          // Auto print (if enabled)
          if (autoPrint) printReceipt({
            id: 0,
            orderId: editing.orderId,
            customerId: editing.customerId,
            customer: cust?.name || walkIn || "",
            phone: cust?.phone || "",
            address: cust?.address || "",
            lineUserId: cust?.lineUserId || "",
            items: cleanedItems,
            status: "รอซักรีด",
            totalAmount: calcTotal(cleanedItems) + editing.hangersBought * 5,
            hangersOwned: editing.hangersOwned,
            hangersBought: editing.hangersBought,
            discount: editing.discount,
            checkPhotos: editing.checkPhotos.length > 0 ? JSON.stringify(editing.checkPhotos) : null,
            note: editing.note,
            date: new Date().toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
          });
        }
      }
    } catch (error) {
      console.error("Failed to save order:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/orders?orderId=${deleteTarget.orderId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await fetchOrders();
        setDeleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to delete order:", error);
    }
  };

  const handleMarkReady = async (o: LaundryOrder) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.orderId, status: "พร้อมส่ง" }),
      });
      if (res.ok) await fetchOrders();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const printReceipt = (o: LaundryOrder) => {
    const totalPrice = o.totalAmount;
    const totalQty = calcQty(o.items);
    const hangerCost = o.hangersBought * 5;
    const subtotal = calcTotal(o.items) + hangerCost;
    const discountAmt = o.discount > 0 ? parseFloat((subtotal * o.discount / 100).toFixed(2)) : 0;
    const itemsHtml = o.items
      .map(
        (i) =>
          `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${(i.qty * i.price).toLocaleString()}</td></tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 0; padding: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 80mm; min-height: auto; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; padding: 4mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 0; font-size: 11px; }
  th { text-align: left; border-bottom: 1px solid #000; }
  .right { text-align: right; }
  .big { font-size: 18px; font-weight: bold; }
  h1 { font-size: 16px; letter-spacing: 3px; margin-bottom: 2px; }
  @media print {
    html, body { width: 80mm; height: auto; overflow: visible; }
    @page { margin: 0; size: 80mm auto; }
  }
</style>
</head><body>
<div class="center">
  <img src="/images/logo.png" style="height:40px;margin:0 auto" alt="Wash Up" />
</div>
<div class="center big" style="margin:8px 0">${o.orderId}</div>
<div class="line"></div>
<div style="margin:4px 0">
  <div>${o.customer}</div>
  <div>โทร: ${o.phone || "-"}</div>
  <div>ที่อยู่: ${o.address || "-"}</div>
  <div>วันที่: ${o.date}</div>
</div>
<div class="line"></div>
<table>
  <thead><tr><th>รายการ</th><th style="text-align:center">Qty</th><th class="right">ราคารวม</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="line"></div>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span>จำนวนชิ้นรวม</span><span class="bold">${totalQty}</span>
</div>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span>ไม้แขวนที่มี</span><span>${o.hangersOwned}</span>
</div>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span>ไม้แขวนที่ซื้อ (5฿/อัน)</span><span>${o.hangersBought}${hangerCost > 0 ? ` = ${hangerCost}฿` : ""}</span>
</div>
${o.discount > 0 ? `
<div class="line"></div>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span>รวมก่อนลด</span><span>${subtotal.toLocaleString()} ฿</span>
</div>
<div style="display:flex;justify-content:space-between;margin:4px 0;color:green">
  <span>ส่วนลด ${o.discount}%</span><span>-${discountAmt.toLocaleString()} ฿</span>
</div>` : ""}
<div class="line"></div>
<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin:6px 0">
  <span>ทั้งหมด</span><span>${totalPrice.toLocaleString()} ฿</span>
</div>
<div class="line"></div>
<div class="center" style="margin-top:8px;font-size:10px">ขอบคุณที่ใช้บริการ WASH UP</div>
</body></html>`;

    // Use hidden iframe to auto-print without popup
    let iframe = document.getElementById("print-frame") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.position = "fixed";
      iframe.style.top = "-10000px";
      iframe.style.left = "-10000px";
      iframe.style.width = "80mm";
      iframe.style.height = "0";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 300);
    }
  };

  const sendToLine = async (order: LaundryOrder) => {
    if (!order.lineUserId) {
      alert("ลูกค้ายังไม่มี LINE User ID กรุณาเพิ่มที่หน้า Customer ก่อน");
      return;
    }
    setSending(order.orderId);
    try {
      const res = await fetch("/api/line/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.orderId,
          lineUserId: order.lineUserId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("ส่งใบเสร็จทาง LINE แล้ว");
      } else {
        alert("ส่งไม่สำเร็จ: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert(
        "เกิดข้อผิดพลาด: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSending(null);
    }
  };

  const viewReceipt = (o: LaundryOrder) => {
    // Load from DB directly to ensure correct packageRemaining
    setReceiptUrl(`/api/receipt/${o.orderId}`);
  };

  const getCustomerLabel = (c: CustomerOption) => {
    const code = c.customerCode ? `[${c.customerCode}] ` : "";
    const phone = c.phone ? ` (${c.phone})` : "";
    return `${code}${c.name}${phone}`;
  };

  const filteredCustomers = customerSearch
    ? customers.filter((c) => {
        const q = customerSearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(q))
        );
      })
    : customers;

  const selectedCustomer = customers.find(
    (c) => c.id === editing.customerId
  );

  // Calculate package deduction for a list of items
  const calcItemsDeduction = (items: LaundryItem[]) => {
    let total = 0;
    for (const item of items) {
      if (!item.name) continue;
      const svc = item.svcId
        ? serviceItems.find((s) => s.id === item.svcId)
        : serviceItems.find((s) => s.name === item.name);
      if (svc?.inPackage) {
        total += item.qty * svc.packageDeduction;
      }
    }
    return total;
  };

  const newDeduction = calcItemsDeduction(editing.items);
  const oldDeduction = calcItemsDeduction(originalItems);
  const deductionDiff = newDeduction - oldDeduction; // positive = ตัดเพิ่ม, negative = คืน

  return (
    <div>
      {saving && <Spinner text="กำลังบันทึก..." />}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Laundry</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !autoPrint;
              setAutoPrint(next);
              localStorage.setItem("washup_auto_print", String(next));
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              autoPrint
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-slate-50 border-slate-300 text-slate-500"
            }`}
          >
            <span>🖨️</span>
            <span className="hidden sm:inline">Auto Print</span>
            <span className={`w-2 h-2 rounded-full ${autoPrint ? "bg-green-500" : "bg-slate-300"}`} />
          </button>
          <button className="btn-primary" onClick={openAdd}>
            + เพิ่มออเดอร์ซัก
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`filter-tab ${activeFilter === f ? "active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="ค้นหา เลขออเดอร์ / ชื่อลูกค้า / เบอร์โทร..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Mobile: Card Layout */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400">ไม่มีรายการ</div>
        ) : (
          paged.map((o) => (
            <div key={o.orderId} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-600 text-lg">{o.orderId}</span>
                <span className={`badge ${statusBadge[o.status] || "badge-gray"}`}>{o.status}</span>
              </div>
              <div className="text-sm text-slate-700 font-medium">{o.customer}</div>
              <div className="text-xs text-slate-400 mb-1">{o.date} — {calcQty(o.items)} ชิ้น — {o.totalAmount.toLocaleString()} ฿</div>
              <div className="text-xs text-slate-500 truncate mb-2">{o.items.map((i) => `${i.name}×${i.qty}`).join(", ")}</div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {o.status === "รอซักรีด" && (
                  <>
                    <button onClick={() => handleMarkReady(o)} className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">พร้อมส่ง</button>
                    <button onClick={() => openEdit(o)} className="text-xs text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg">แก้ไข</button>
                    <button onClick={() => setDeleteTarget(o)} className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">ลบ</button>
                  </>
                )}
                {o.checkPhotos && (
                  <button onClick={() => { try { setViewCheckPhotos(JSON.parse(o.checkPhotos!)); } catch { /* */ } }} className="text-xs text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-lg">รูป</button>
                )}
                <button onClick={() => viewReceipt(o)} className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">บิล</button>
                <button onClick={() => printReceipt(o)} className="text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">ปริ้น</button>
                <button onClick={() => sendToLine(o)} disabled={sending === o.orderId} className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg disabled:opacity-50">{sending === o.orderId ? "..." : "LINE"}</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table Layout */}
      <div className="card hidden sm:block">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ออเดอร์</th>
                <th>ลูกค้า</th>
                <th>รายการ</th>
                <th className="text-right">ชิ้น</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th className="text-right">ยอดรวม</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-8">
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : (
                paged.map((o) => (
                  <tr key={o.orderId}>
                    <td className="font-medium text-blue-600">{o.orderId}</td>
                    <td>{o.customer}</td>
                    <td className="text-slate-500 max-w-[200px]">
                      <span className="truncate block">
                        {o.items.map((i) => i.name).join(", ")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {o.items.length} รายการ
                      </span>
                    </td>
                    <td className="text-right">{calcQty(o.items)}</td>
                    <td>
                      <span
                        className={`badge ${statusBadge[o.status] || "badge-gray"}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="text-slate-500">{o.date}</td>
                    <td className="text-right font-medium">
                      {o.totalAmount.toLocaleString()} ฿
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {o.status === "รอซักรีด" && (
                          <>
                            <button
                              onClick={() => handleMarkReady(o)}
                              className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-md hover:bg-green-100"
                            >
                              พร้อมส่ง
                            </button>
                            <button
                              onClick={() => openEdit(o)}
                              className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-100"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={() => setDeleteTarget(o)}
                              className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-100"
                            >
                              ลบ
                            </button>
                          </>
                        )}
                        {o.checkPhotos && (
                          <button
                            onClick={() => {
                              try { setViewCheckPhotos(JSON.parse(o.checkPhotos!)); } catch { /* */ }
                            }}
                            className="text-xs font-medium text-cyan-600 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-md hover:bg-cyan-100"
                          >
                            รูป
                          </button>
                        )}
                        <button
                          onClick={() => viewReceipt(o)}
                          className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md hover:bg-purple-100"
                        >
                          บิล
                        </button>
                        <button
                          onClick={() => printReceipt(o)}
                          className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-md hover:bg-orange-100"
                        >
                          ปริ้นบิล
                        </button>
                        <button
                          onClick={() => sendToLine(o)}
                          disabled={sending === o.orderId}
                          className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {sending === o.orderId ? "กำลังส่ง..." : "ส่ง LINE"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingOrderId ? "แก้ไขออเดอร์ซัก" : "เพิ่มออเดอร์ซักใหม่"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              เลขออเดอร์
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-slate-50 focus:outline-none"
              value={editing.orderId}
              disabled
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ลูกค้า
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (!e.target.value) {
                  setEditing((prev) => ({ ...prev, customerId: 0, walkInName: "" }));
                }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="พิมพ์ค้นหาชื่อ / เบอร์ / รหัส หรือพิมพ์ชื่อลูกค้าทั่วไป"
              disabled={!!editingOrderId}
            />
            {showCustomerDropdown && !editingOrderId && filteredCustomers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
                    onClick={() => {
                      setEditing((prev) => ({ ...prev, customerId: c.id, walkInName: "" }));
                      setCustomerSearch(getCustomerLabel(c));
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <span className="font-medium">{c.customerCode ? `[${c.customerCode}] ` : ""}{c.name}</span>
                    {c.phone && <span className="text-slate-400 ml-1">({c.phone})</span>}
                  </button>
                ))}
              </div>
            )}
            {editing.customerId === 0 && customerSearch && !showCustomerDropdown && (
              <p className="text-xs text-amber-600 mt-1">ลูกค้าทั่วไป: {customerSearch}</p>
            )}
            {selectedCustomer && (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-slate-400">
                  {selectedCustomer.address}
                </p>
                {selectedCustomer.package && (
                  <p className="text-xs">
                    <span className="text-slate-500">แพ็คเกจ: </span>
                    <span className="font-medium text-blue-600">{selectedCustomer.package}</span>
                    <span className="text-slate-400"> — คงเหลือ </span>
                    <span className={`font-medium ${selectedCustomer.remaining <= 0 ? "text-red-500" : "text-green-600"}`}>
                      {selectedCustomer.remaining} ชิ้น
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Items list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-600">
                รายการผ้า
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                เพิ่มรายการ
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-1.5 sm:gap-2 text-xs font-medium text-slate-400 px-1">
                <div className="col-span-5">ชื่อรายการ</div>
                <div className="col-span-2 text-center">จำนวน</div>
                <div className="col-span-3 text-center">ราคา/ชิ้น</div>
                <div className="col-span-2 text-right">รวม</div>
              </div>

              {editing.items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center bg-slate-50 rounded-lg p-2"
                >
                  <div className="col-span-5 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(serviceItems.map((s) => s.category))).map((cat) => {
                        const shortNames: Record<string, string> = {
                          "รายการในแพ็คเกจ": "แพ็คเกจ",
                          "รายการซักอบรีด": "ซักอบรีด",
                          "รายการซักแห้ง": "ซักแห้ง",
                          "รายการรีดอย่างเดียว": "รีด",
                          "ซัก อบ พับ": "ซักพับ",
                        };
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setSelectedCategory((prev) => ({ ...prev, [index]: cat }));
                              // Reset item selection when changing category
                              if (selectedCategory[index] !== cat) {
                                const newItems = editing.items.map((it, i) =>
                                  i === index ? { ...emptyItem } : it
                                );
                                setEditing({ ...editing, items: newItems });
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                              selectedCategory[index] === cat
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                            }`}
                          >
                            {shortNames[cat] || cat}
                          </button>
                        );
                      })}
                    </div>
                    <select
                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={item.svcId || ""}
                      onChange={(e) =>
                        handleSelectServiceItem(index, e.target.value)
                      }
                      disabled={!selectedCategory[index]}
                    >
                      <option value="">
                        {selectedCategory[index] ? "-- เลือกรายการ --" : "-- เลือกหมวดก่อน --"}
                      </option>
                      {selectedCategory[index] &&
                        serviceItems
                          .filter((s) => s.category === selectedCategory[index])
                          .map((s) => (
                            <option key={s.id} value={`${s.id}`}>
                              {s.name}{s.nameEn ? ` (${s.nameEn})` : ""} ({s.price}฿)
                            </option>
                          ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(index, "qty", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(index, "price", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="w-1/3 sm:w-auto sm:col-span-2 flex items-center justify-end gap-1">
                    <span className="text-xs font-medium text-slate-600">
                      {(item.qty * item.price).toLocaleString()}
                    </span>
                    {editing.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-600 ml-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(() => {
              const subtotal = calcTotal(editing.items) + editing.hangersBought * 5;
              const discountAmt = editing.discount > 0 ? parseFloat((subtotal * editing.discount / 100).toFixed(2)) : 0;
              const grandTotal = subtotal - discountAmt;
              return (
                <>
                  <div className="flex justify-between items-center mt-3 px-2 py-2 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">
                      รวมทั้งหมด ({calcQty(editing.items)} ชิ้น{editing.hangersBought > 0 ? ` + ไม้แขวน ${editing.hangersBought} อัน` : ""})
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {subtotal.toLocaleString()} ฿
                    </span>
                  </div>
                  {editing.discount > 0 && (
                    <div className="flex justify-between items-center px-2 py-2 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-700">
                        ส่วนลด {editing.discount}%
                      </span>
                      <span className="text-sm font-bold text-green-700">
                        -{discountAmt.toLocaleString()} ฿
                      </span>
                    </div>
                  )}
                  {editing.discount > 0 && (
                    <div className="flex justify-between items-center px-2 py-2 bg-blue-100 rounded-lg">
                      <span className="text-sm font-bold text-blue-700">
                        ยอดสุทธิ
                      </span>
                      <span className="text-sm font-bold text-blue-700">
                        {grandTotal.toLocaleString()} ฿
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
            {deductionDiff !== 0 && selectedCustomer && (
              <div className={`flex justify-between items-center px-2 py-2 rounded-lg ${deductionDiff > 0 ? "bg-amber-50" : "bg-green-50"}`}>
                <span className={`text-sm font-medium ${deductionDiff > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {editingOrderId ? "ตัดเพิ่ม/คืนแพ็คเกจ" : "ตัดจากแพ็คเกจ"}
                </span>
                <span className={`text-sm font-bold ${deductionDiff > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {deductionDiff > 0 ? `-${deductionDiff}` : `+${Math.abs(deductionDiff)}`} ชิ้น (เหลือ {selectedCustomer.remaining - deductionDiff})
                </span>
              </div>
            )}
            {deductionDiff === 0 && editingOrderId && newDeduction > 0 && selectedCustomer && (
              <div className="flex justify-between items-center px-2 py-2 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-500">
                  แพ็คเกจไม่เปลี่ยนแปลง
                </span>
                <span className="text-sm font-bold text-slate-500">
                  คงเหลือ {selectedCustomer.remaining} ชิ้น
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                ไม้แขวนที่มี
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.hangersOwned}
                onChange={(e) =>
                  setEditing({ ...editing, hangersOwned: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                ไม้แขวนที่ซื้อ (5฿/อัน)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.hangersBought}
                onChange={(e) =>
                  setEditing({ ...editing, hangersBought: Number(e.target.value) })
                }
              />
              {editing.hangersBought > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  ค่าไม้แขวน: {(editing.hangersBought * 5).toLocaleString()} ฿
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              ส่วนลด (%)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.discount}
                onChange={(e) =>
                  setEditing({ ...editing, discount: Number(e.target.value) })
                }
              />
              <div className="flex gap-1 shrink-0">
                {[5, 10].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEditing({ ...editing, discount: d })}
                    className={`px-2 py-1.5 rounded text-xs font-medium border ${
                      editing.discount === d
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* รูปตรวจกระเป๋า/ของที่ลืม */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              รูปตรวจกระเป๋า / ของที่ลืม
            </label>
            <input
              ref={checkPhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={async (e) => {
                const files = e.target.files;
                if (!files) return;
                for (const file of Array.from(files)) {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", { method: "POST", body: formData });
                  const data = await res.json();
                  if (data.success) {
                    setEditing((prev) => ({
                      ...prev,
                      checkPhotos: [...prev.checkPhotos, data.url],
                    }));
                  }
                }
                if (checkPhotoRef.current) checkPhotoRef.current.value = "";
              }}
              className="hidden"
            />
            {editing.checkPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                {editing.checkPhotos.map((url, idx) => (
                  <div key={idx} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`check-${idx}`} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setEditing((prev) => ({
                        ...prev,
                        checkPhotos: prev.checkPhotos.filter((_, i) => i !== idx),
                      }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => checkPhotoRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 text-sm"
            >
              {editing.checkPhotos.length > 0 ? `+ เพิ่มรูป (${editing.checkPhotos.length} รูป)` : "ถ่ายรูป / เลือกรูป"}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              หมายเหตุ
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.note}
              onChange={(e) =>
                setEditing({ ...editing, note: e.target.value })
              }
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            />
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
              disabled={!editing.customerId && !customerSearch.trim()}
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
        name={deleteTarget?.orderId || ""}
      />

      <Modal
        isOpen={!!receiptUrl}
        onClose={() => setReceiptUrl(null)}
        title="Invoice"
      >
        {receiptUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receiptUrl}
            alt="receipt"
            className="w-full rounded-lg"
          />
        )}
      </Modal>

      <Modal
        isOpen={!!viewCheckPhotos}
        onClose={() => setViewCheckPhotos(null)}
        title="รูปตรวจกระเป๋า / ของที่ลืม"
      >
        {viewCheckPhotos && (
          <div className="space-y-3">
            {viewCheckPhotos.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={url} alt={`check-${idx}`} className="w-full rounded-lg" />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
