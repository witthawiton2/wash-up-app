import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { generatePromptPayQR } from "@/lib/promptpay-qr";
import { formatDateTime, formatDate } from "@/lib/timezone";
import { LOGO_DATA_URI } from "@/lib/logo-data";

export const runtime = "nodejs";

interface LaundryItem {
  name: string;
  qty: number;
  price: number;
  isPackage?: boolean; // อยู่ในแพคเกจ
}

interface OrderData {
  id: string;
  customer: string;
  phone: string;
  items: LaundryItem[];
  date: string;
  packageExpiry: string;
  packageRemaining: number;
  hangersOwned: number;
  hangersBought: number;
  discount: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
  const orderParam = request.nextUrl.searchParams.get("data");
  const isEdited = request.nextUrl.searchParams.get("edited") === "1";
  let order: OrderData | undefined;

  if (orderParam) {
    try {
      order = JSON.parse(Buffer.from(orderParam, "base64").toString("utf-8"));
    } catch {
      // ignore
    }
  }

  // Fallback: load from DB if no query param
  if (!order) {
    try {
      const dbOrder = await prisma.order.findUnique({
        where: { orderId },
        include: { customer: true, items: true },
      });
      if (dbOrder) {
        order = {
          id: dbOrder.orderId,
          customer: dbOrder.customer
            ? `${dbOrder.customer.customerCode ? dbOrder.customer.customerCode + " " : ""}${dbOrder.customer.name}`
            : dbOrder.walkInName || "",
          phone: dbOrder.customer?.phone || "",
          items: dbOrder.items.map((i) => ({
            name: i.itemName,
            qty: i.quantity,
            price: i.price,
          })),
          date: formatDateTime(dbOrder.orderDate),
          hangersOwned: dbOrder.hangersOwned,
          hangersBought: dbOrder.hangersBought,
          discount: dbOrder.discount,
          packageExpiry: dbOrder.customer?.endDate
            ? formatDate(dbOrder.customer.endDate)
            : "-",
          packageRemaining: dbOrder.customer?.remaining ?? 0,
        };
      }
    } catch {
      // ignore DB errors
    }
  }

  if (!order) {
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0) + (order.hangersBought ?? 0) * 5;
  const disc = order.discount ?? 0;
  const discountAmt = disc > 0 ? parseFloat((subtotal * disc / 100).toFixed(2)) : 0;
  const totalPrice = subtotal - discountAmt;
  const promptpayAccount = process.env.PROMPTPAY_ACCOUNT || "";
  const promptpayName = process.env.PROMPTPAY_NAME || "";

  // Generate PromptPay QR with amount
  let qrDataUri: string | null = null;
  if (promptpayAccount) {
    try {
      qrDataUri = await generatePromptPayQR(promptpayAccount, totalPrice > 0 ? totalPrice : undefined);
    } catch {
      // QR generation failed, skip
    }
  }

  const rowStyle = {
    display: "flex" as const,
    fontSize: 13,
    color: "#1e293b",
    marginBottom: 3,
  };

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          padding: "30px 36px",
          fontFamily: "NotoSansThai, sans-serif",
        }}
      >
        {/* Header - Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_DATA_URI} alt="Wash Up" width={280} height={70} style={{ objectFit: "contain" }} />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            Invoice
          </div>
          {isEdited && (
            <div
              style={{
                display: "flex",
                fontSize: 14,
                fontWeight: 700,
                color: "#dc2626",
                marginTop: 4,
              }}
            >
              ** รายการแก้ไข **
            </div>
          )}
        </div>

        {/* Order Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: 14,
          }}
        >
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <span>รหัสใบสั่งซื้อ: {order.id}</span>
            <span>วันที่: {order.date}</span>
          </div>
          <div style={rowStyle}>
            <span>ชื่อลูกค้า: {order.customer}</span>
          </div>
          <div style={rowStyle}>
            <span>โทรศัพท์: {order.phone || "-"}</span>
          </div>
          <div style={rowStyle}>
            <span>วันที่หมดอายุ: {order.packageExpiry || "-"}</span>
          </div>
          <div style={{
            ...rowStyle,
            ...((order.packageRemaining ?? 0) <= 0 ? { color: "#dc2626", fontWeight: 700 } : {}),
          }}>
            <span>จำนวนที่เหลือในแพ็คเกจ: {order.packageRemaining ?? 0}</span>
          </div>
          {(order.packageRemaining ?? 0) <= 0 && (
            <div style={{ ...rowStyle, color: "#dc2626", fontWeight: 700, fontSize: 14, marginTop: 4 }}>
              <span>⚠️ ยอดแพ็คเกจหมดแล้ว กรุณาต่ออายุแพ็คเกจ</span>
            </div>
          )}
        </div>

        {/* Table */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: 10,
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#f1f5f9",
              borderTop: "1px solid #94a3b8",
              borderBottom: "1px solid #94a3b8",
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            <span style={{ width: 160 }}>รายการ</span>
            <span style={{ width: 60, textAlign: "center" }}>จำนวน</span>
            <span style={{ width: 80, textAlign: "center" }}>ราคา/หน่วย</span>
            <span style={{ width: 70, textAlign: "right" }}>รวม</span>
          </div>

          {/* Table Rows */}
          {order.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                padding: "6px 8px",
                fontSize: 12,
                color: "#1e293b",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span style={{ width: 160 }}>
                {item.name}
                {item.isPackage ? "(อยู่ในแพคเกจ(ตัดยอด1ชิ้น))" : ""}
              </span>
              <span style={{ width: 60, textAlign: "center" }}>{item.qty}</span>
              <span style={{ width: 80, textAlign: "center" }}>
                {item.price.toLocaleString()}
              </span>
              <span style={{ width: 70, textAlign: "right" }}>
                {(item.qty * item.price).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Hangers */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 12,
            color: "#1e293b",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", marginBottom: 2 }}>
            จำนวนไม้แขวนที่มี: {order.hangersOwned ?? 0}
          </div>
          <div style={{ display: "flex" }}>
            จำนวนไม้แขวนที่ซื้อ: {order.hangersBought ?? 0}
            {(order.hangersBought ?? 0) > 0 && ` (${(order.hangersBought ?? 0) * 5} บาท)`}
          </div>
        </div>

        {/* Discount & Total */}
        {disc > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 6 }}>
            <div style={{ display: "flex", fontSize: 13, color: "#1e293b", marginBottom: 2 }}>
              รวมก่อนลด: {subtotal.toLocaleString()} บาท
            </div>
            <div style={{ display: "flex", fontSize: 13, color: "#16a34a", fontWeight: 700 }}>
              ส่วนลด {disc}%: -{discountAmt.toLocaleString()} บาท
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 15,
            fontWeight: 700,
            color: "#1e293b",
            marginBottom: 16,
          }}
        >
          ยอดรวมทั้งหมด: {totalPrice.toLocaleString()} บาท
        </div>

        {/* PromptPay Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 13, color: "#1e293b", marginBottom: 8 }}>
            ชำระผ่าน PromptPay QR Code:
          </div>
          {qrDataUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUri}
              alt="PromptPay QR"
              width={200}
              height={200}
              style={{ borderRadius: 8 }}
            />
          )}
          {promptpayAccount && (
            <div style={{ display: "flex", fontWeight: 700, fontSize: 15, marginTop: 8 }}>
              {promptpayAccount} กสิกร
            </div>
          )}
          {promptpayName && (
            <div style={{ display: "flex", fontWeight: 700, fontSize: 14, marginTop: 2 }}>
              {promptpayName}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 12, color: "#1e293b", fontWeight: 600, marginTop: 8 }}>
            โอนแล้ว รบกวนส่งสลิปให้ด้วยนะคร้าบ
          </div>
        </div>
      </div>
    ),
    {
      width: 500,
      height: 530 + order.items.length * 28 + (disc > 0 ? 40 : 0) + (qrDataUri ? 300 : 0),
    }
  );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
