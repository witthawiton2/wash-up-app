import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { formatDateTime } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const daysParam = searchParams.get("days");
    const limitParam = searchParams.get("limit");

    const where: Record<string, unknown> = {};
    if (statusParam) {
      where.status = statusParam.includes(",")
        ? { in: statusParam.split(",") }
        : statusParam;
    }
    if (daysParam) {
      const days = parseInt(daysParam, 10);
      if (!isNaN(days) && days > 0) {
        const from = new Date();
        from.setDate(from.getDate() - days);
        where.orderDate = { gte: from };
      }
    }

    const take = limitParam ? Math.min(parseInt(limitParam, 10) || 500, 1000) : undefined;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    const formatted = orders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      customerId: o.customerId || 0,
      customer: o.customer
        ? `${o.customer.customerCode ? o.customer.customerCode + " " : ""}${o.customer.name}`
        : o.walkInName || "",
      phone: o.customer?.phone || "",
      address: o.customer?.address || "",
      lineUserId: o.customer?.lineUserId || "",
      items: o.items.map((i) => ({
        name: i.itemName,
        qty: i.quantity,
        price: i.price,
      })),
      status: o.status,
      totalAmount: o.totalAmount,
      hangersOwned: o.hangersOwned,
      hangersBought: o.hangersBought,
      discount: o.discount,
      checkPhotos: o.checkPhotos || null,
      note: o.note || "",
      date: formatDateTime(o.orderDate),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, customerId, walkInName, items, note, hangersOwned, hangersBought, discount, checkPhotos } = body;

    if (!orderId || !items?.length) {
      return NextResponse.json(
        { error: "orderId and items are required" },
        { status: 400 }
      );
    }

    if (!customerId && !walkInName) {
      return NextResponse.json(
        { error: "customerId or walkInName is required" },
        { status: 400 }
      );
    }

    const hBought = hangersBought || 0;
    const disc = discount || 0;
    const subtotal = items.reduce(
      (sum: number, i: { qty: number; price: number }) => sum + i.qty * i.price,
      0
    ) + hBought * 5;
    const totalAmount = disc > 0 ? parseFloat((subtotal * (1 - disc / 100)).toFixed(2)) : subtotal;

    // Calculate package deduction
    const itemNames = items.map((i: { name: string }) => i.name);
    const serviceItems = await prisma.serviceItem.findMany({
      where: { name: { in: itemNames }, inPackage: true, active: true },
    });
    const serviceMap = new Map(serviceItems.map((s) => [s.name, s.packageDeduction]));

    let totalDeduction = 0;
    for (const item of items as { name: string; qty: number; price: number }[]) {
      const deduction = serviceMap.get(item.name);
      if (deduction) {
        totalDeduction += item.qty * deduction;
      }
    }

    const order = await prisma.order.create({
      data: {
        orderId,
        customerId: customerId || null,
        walkInName: customerId ? null : (walkInName || null),
        status: "รอซักรีด",
        totalAmount,
        hangersOwned: hangersOwned || 0,
        hangersBought: hBought,
        discount: disc,
        checkPhotos: checkPhotos || null,
        note: note || null,
        items: {
          create: items.map(
            (i: { name: string; qty: number; price: number }) => ({
              itemName: i.name,
              quantity: i.qty,
              price: i.price,
              total: i.qty * i.price,
            })
          ),
        },
      },
      include: { customer: true, items: true },
    });

    // Deduct from customer's package remaining
    if (totalDeduction > 0) {
      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          remaining: { decrement: totalDeduction },
        },
      });

      // If remaining <= 0, add package price to order + set renewPending
      if (updatedCustomer.remaining <= 0 && !updatedCustomer.renewPending) {
        const pkgData = await prisma.package.findFirst({
          where: { name: updatedCustomer.package || "", active: true },
        });
        const pkgPrice = pkgData?.price || 0;

        // Add package price to this order's totalAmount
        if (pkgPrice > 0) {
          await prisma.order.update({
            where: { orderId },
            data: {
              totalAmount: { increment: pkgPrice },
              note: (order.note ? order.note + " | " : "") + `ค่าต่อแพ็คเกจ ${updatedCustomer.package} ${pkgPrice}฿`,
            },
          });
        }

        await prisma.customer.update({
          where: { id: customerId },
          data: { renewPending: true },
        });
      }

      if (updatedCustomer.lineUserId) {
        // Alert: remaining < 10
        if (updatedCustomer.remaining < 10) {
          const remaining = updatedCustomer.remaining;
          const message =
            remaining <= 0
              ? `⚠️ แจ้งเตือน\nยอดแพ็กเกจของลูกค้าเหลือน้อย หรือหมดแล้วนะครับ\n\nกดต่ออายุแพ็กเกจได้เลยครับ 😊`
              : `⚠️ แจ้งเตือน\nยอดแพ็กเกจของลูกค้าเหลือน้อย (เหลือ ${remaining} ชิ้น)\n\nกดต่ออายุแพ็กเกจได้เลยครับ 😊`;
          pushTextMessage(updatedCustomer.lineUserId, message).catch((err) =>
            console.error("Failed to send LINE low-package alert:", err)
          );
        }

        // Alert: package expiring soon or expired
        if (updatedCustomer.endDate) {
          const now = new Date();
          const endDate = new Date(updatedCustomer.endDate);
          const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysLeft <= 0) {
            pushTextMessage(
              updatedCustomer.lineUserId,
              `⚠️ แจ้งเตือน\nแพ็กเกจของคุณหมดอายุแล้วครับ\n\nกดต่ออายุแพ็กเกจได้เลยครับ 😊`
            ).catch((err) => console.error("Failed to send LINE expiry alert:", err));
          } else if (daysLeft <= 7) {
            pushTextMessage(
              updatedCustomer.lineUserId,
              `⏰ แจ้งเตือน\nแพ็กเกจของคุณจะหมดอายุใน ${daysLeft} วัน\n\nกดต่ออายุแพ็กเกจได้เลยครับ 😊`
            ).catch((err) => console.error("Failed to send LINE expiry alert:", err));
          }
        }
      }
    }

    return NextResponse.json({ ...order, packageDeducted: totalDeduction });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, items, note, hangersOwned, hangersBought, discount, checkPhotos } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (note !== undefined) updateData.note = note;
    if (hangersOwned !== undefined) updateData.hangersOwned = hangersOwned;
    if (hangersBought !== undefined) updateData.hangersBought = hangersBought;
    if (discount !== undefined) updateData.discount = discount;
    if (checkPhotos !== undefined) updateData.checkPhotos = checkPhotos;

    // If items are provided, recalculate total and replace items
    if (items?.length) {
      const hb = hangersBought || 0;
      const disc = discount || 0;
      const subtotal = items.reduce(
        (sum: number, i: { qty: number; price: number }) =>
          sum + i.qty * i.price,
        0
      ) + hb * 5;
      const totalAmount = disc > 0 ? parseFloat((subtotal * (1 - disc / 100)).toFixed(2)) : subtotal;
      updateData.totalAmount = totalAmount;

      const order = await prisma.order.findUnique({
        where: { orderId },
        include: { items: true },
      });
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 }
        );
      }

      // Calculate old deduction
      const allItemNames = [
        ...order.items.map((i) => i.itemName),
        ...items.map((i: { name: string }) => i.name),
      ];
      const serviceItems = await prisma.serviceItem.findMany({
        where: { name: { in: allItemNames }, inPackage: true, active: true },
      });
      const svcMap = new Map(
        serviceItems.map((s) => [s.name, s.packageDeduction])
      );

      let oldDeduction = 0;
      for (const item of order.items) {
        const ded = svcMap.get(item.itemName);
        if (ded) oldDeduction += item.quantity * ded;
      }

      let newDeduction = 0;
      for (const item of items as { name: string; qty: number; price: number }[]) {
        const ded = svcMap.get(item.name);
        if (ded) newDeduction += item.qty * ded;
      }

      const diff = newDeduction - oldDeduction;

      // Delete old items and create new ones
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.update({
        where: { orderId },
        data: {
          ...updateData,
          items: {
            create: items.map(
              (i: { name: string; qty: number; price: number }) => ({
                itemName: i.name,
                quantity: i.qty,
                price: i.price,
                total: i.qty * i.price,
              })
            ),
          },
        },
      });

      // Adjust customer remaining by the difference
      if (diff !== 0 && order.customerId) {
        await prisma.customer.update({
          where: { id: order.customerId },
          data: {
            remaining: { decrement: diff },
          },
        });
      }
    } else {
      await prisma.order.update({
        where: { orderId },
        data: updateData,
      });
    }

    // Send LINE notification when order is ready for delivery
    if (status === "พร้อมส่ง") {
      const orderWithCustomer = await prisma.order.findUnique({
        where: { orderId },
        include: { customer: true, items: true },
      });
      if (orderWithCustomer?.customer?.lineUserId) {
        const itemsList = orderWithCustomer.items
          .map((i) => `• ${i.itemName} x${i.quantity}`)
          .join("\n");
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wash-up-app.vercel.app";
        const message = `✅ ซักเสร็จแล้วครับ!\n\nออเดอร์: ${orderId}\n${itemsList}\n\nกดจองเวลานัดรับส่งได้เลยครับ 🚚\n${baseUrl}/my?tab=booking`;
        pushTextMessage(orderWithCustomer.customer.lineUserId, message).catch(
          (err) => console.error("Failed to send LINE ready notification:", err)
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Delete items first, then order
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { orderId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
