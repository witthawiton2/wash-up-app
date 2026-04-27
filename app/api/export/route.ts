import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "orders";

    if (type === "orders") {
      const orders = await prisma.order.findMany({
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
      });

      const bom = "\uFEFF";
      const header = "เลขออเดอร์,ลูกค้า,เบอร์โทร,รายการ,จำนวนชิ้น,ยอดรวม,ส่วนลด(%),สถานะ,วันที่\n";
      const rows = orders.map((o) => {
        const items = o.items.map((i) => `${i.itemName}x${i.quantity}`).join(" | ");
        const totalQty = o.items.reduce((s, i) => s + i.quantity, 0);
        const date = o.orderDate.toLocaleDateString("th-TH");
        const customer = o.customer?.name || o.walkInName || "";
        const phone = o.customer?.phone || "";
        return `"${o.orderId}","${customer}","${phone}","${items}",${totalQty},${o.totalAmount},${o.discount},"${o.status}","${date}"`;
      }).join("\n");

      return new Response(bom + header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    if (type === "customers") {
      const customers = await prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
      });

      const bom = "\uFEFF";
      const header = "รหัสลูกค้า,ชื่อ,เบอร์โทร,ที่อยู่,แพ็คเกจ,คงเหลือ,วันหมดอายุ,สถานะ\n";
      const rows = customers.map((c) => {
        const endDate = c.endDate ? c.endDate.toLocaleDateString("th-TH") : "-";
        return `"${c.customerCode || ""}","${c.name}","${c.phone || ""}","${c.address || ""}","${c.package || ""}",${c.remaining},"${endDate}","${c.status}"`;
      }).join("\n");

      return new Response(bom + header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
