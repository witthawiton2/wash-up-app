import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage, pushTextWithImages } from "@/lib/line-api";
import { formatDateTime } from "@/lib/timezone";
import { getBaseUrl } from "@/lib/base-url";
import { sendCustomerPush } from "@/lib/push";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const daysParam = searchParams.get("days");
    const limitParam = searchParams.get("limit");
    const fromParam = searchParams.get("from"); // YYYY-MM-DD (Bangkok)
    const toParam = searchParams.get("to");     // YYYY-MM-DD (Bangkok)

    const where: Record<string, unknown> = {};
    if (statusParam) {
      where.status = statusParam.includes(",")
        ? { in: statusParam.split(",") }
        : statusParam;
    }

    // Explicit from/to wins over the rolling `days` window when both are
    // supplied. Times are anchored to Asia/Bangkok so the range matches
    // what the dashboard user picked on their date inputs.
    if (fromParam || toParam) {
      const orderDateFilter: Record<string, Date> = {};
      if (fromParam) orderDateFilter.gte = new Date(`${fromParam}T00:00:00+07:00`);
      if (toParam) orderDateFilter.lte = new Date(`${toParam}T23:59:59.999+07:00`);
      where.orderDate = orderDateFilter;
    } else if (daysParam) {
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

    // Run the order insert and the package-deduction lookup in parallel.
    // For walk-in orders skip the lookup entirely — no package to deduct.
    const itemNames = items.map((i: { name: string }) => i.name);
    const [serviceItems, order] = await Promise.all([
      customerId
        ? prisma.serviceItem.findMany({
            where: { name: { in: itemNames }, inPackage: true, active: true },
          })
        : Promise.resolve([] as { name: string; packageDeduction: number }[]),
      prisma.order.create({
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
      }),
    ]);

    const serviceMap = new Map(serviceItems.map((s) => [s.name, s.packageDeduction]));

    let totalDeduction = 0;
    for (const item of items as { name: string; qty: number; price: number }[]) {
      const deduction = serviceMap.get(item.name);
      if (deduction) {
        totalDeduction += item.qty * deduction;
      }
    }

    // Deduct from customer's package remaining
    if (totalDeduction > 0) {
      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          remaining: { decrement: totalDeduction },
        },
      });
      const oldRemaining = updatedCustomer.remaining + totalDeduction;

      // If remaining <= 0, add package price to order + set renewPending
      if (updatedCustomer.remaining <= 0 && !updatedCustomer.renewPending) {
        const pkgData = await prisma.package.findFirst({
          where: { name: updatedCustomer.package || "", active: true },
        });
        const pkgPrice = pkgData?.price || 0;

        // Add package price to this order's totalAmount + flip renewPending
        // — run both writes in parallel since they touch different rows.
        await Promise.all([
          pkgPrice > 0
            ? prisma.order.update({
                where: { orderId },
                data: {
                  totalAmount: { increment: pkgPrice },
                  note: (order.note ? order.note + " | " : "") + `ค่าต่อแพ็คเกจ ${updatedCustomer.package} ${pkgPrice}฿`,
                },
              })
            : Promise.resolve(),
          prisma.customer.update({
            where: { id: customerId },
            data: { renewPending: true },
          }),
        ]);
      }

      if (updatedCustomer.lineUserId) {
        // Alert when the order just crossed the low-balance threshold.
        // Using the crossing condition (old > N && new <= N) prevents
        // re-sending the same nudge on every subsequent order while the
        // balance stays low.
        const LOW_BALANCE_THRESHOLD = 5;
        if (oldRemaining > LOW_BALANCE_THRESHOLD && updatedCustomer.remaining <= LOW_BALANCE_THRESHOLD) {
          const remaining = updatedCustomer.remaining;
          const baseUrl = getBaseUrl();
          const message =
            remaining <= 0
              ? `⚠️ แพ็กเกจของคุณหมดแล้ว\n\nกดต่ออายุแพ็กเกจได้ที่นี่ครับ 😊\n${baseUrl}/my?tab=package`
              : `⚠️ แพ็กเกจของคุณเหลือ ${remaining} ชิ้น\n\nเติมแพ็กเกจล่วงหน้าได้ที่นี่ครับ 😊\n${baseUrl}/my?tab=package`;
          pushTextMessage(updatedCustomer.lineUserId, message).catch((err) =>
            console.error("Failed to send LINE low-package alert:", err)
          );
          sendCustomerPush(updatedCustomer.id, {
            title: remaining <= 0 ? "แพ็กเกจหมดแล้ว" : `แพ็กเกจเหลือ ${remaining} ชิ้น`,
            body: "เติมแพ็กเกจล่วงหน้าได้เลย",
            url: "/my?tab=package",
          }).catch(() => {});
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

    // Forgot-items: send photos + text to customer's LINE chat
    if (checkPhotos && order.customer?.lineUserId) {
      try {
        const urls: string[] = JSON.parse(checkPhotos);
        if (Array.isArray(urls) && urls.length > 0) {
          const message = `📸 พบสิ่งของในเสื้อผ้าของคุณ\n\nออเดอร์: ${orderId}\nทางร้านพบสิ่งของในกระเป๋าเสื้อผ้า รบกวนตรวจสอบและรับคืนได้ที่ร้านครับ`;
          pushTextWithImages(order.customer.lineUserId, message, urls).catch((err) =>
            console.error("Failed to send LINE forgot-items notification:", err)
          );
        }
      } catch {
        // checkPhotos is not valid JSON — ignore
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

      // Fetch the order (with items) and the package serviceItems lookup
      // in parallel — they're independent reads.
      const [order, serviceItems] = await Promise.all([
        prisma.order.findUnique({
          where: { orderId },
          include: { items: true },
        }),
        prisma.serviceItem.findMany({
          where: { inPackage: true, active: true },
        }),
      ]);
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 }
        );
      }

      const svcMap = new Map(serviceItems.map((s) => [s.name, s.packageDeduction]));

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

      // Replace items + update order in a single round-trip using nested
      // deleteMany + create.
      await prisma.order.update({
        where: { orderId },
        data: {
          ...updateData,
          items: {
            deleteMany: {},
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
        const updatedCustomer = await prisma.customer.update({
          where: { id: order.customerId },
          data: {
            remaining: { decrement: diff },
          },
        });
        const oldRemainingPut = updatedCustomer.remaining + diff;

        // Same threshold-crossing push as POST — only fires when this edit
        // pushes the balance across the low-balance line.
        const LOW_BALANCE_THRESHOLD = 5;
        if (
          updatedCustomer.lineUserId &&
          oldRemainingPut > LOW_BALANCE_THRESHOLD &&
          updatedCustomer.remaining <= LOW_BALANCE_THRESHOLD
        ) {
          const baseUrl = getBaseUrl();
          const r = updatedCustomer.remaining;
          const message =
            r <= 0
              ? `⚠️ แพ็กเกจของคุณหมดแล้ว\n\nกดต่ออายุแพ็กเกจได้ที่นี่ครับ 😊\n${baseUrl}/my?tab=package`
              : `⚠️ แพ็กเกจของคุณเหลือ ${r} ชิ้น\n\nเติมแพ็กเกจล่วงหน้าได้ที่นี่ครับ 😊\n${baseUrl}/my?tab=package`;
          pushTextMessage(updatedCustomer.lineUserId, message).catch((err) =>
            console.error("Failed to send LINE low-package alert (PUT):", err)
          );
        }

        // If remaining just dropped to <=0 and renewal isn't already pending,
        // add the package renewal fee to this order's total (same behaviour as POST)
        if (updatedCustomer.remaining <= 0 && !updatedCustomer.renewPending) {
          const pkgData = await prisma.package.findFirst({
            where: { name: updatedCustomer.package || "", active: true },
          });
          const pkgPrice = pkgData?.price || 0;

          if (pkgPrice > 0) {
            const existingNote = (updateData.note as string | undefined) ?? order.note ?? "";
            const renewNote = `ค่าต่อแพ็คเกจ ${updatedCustomer.package} ${pkgPrice}฿`;
            await prisma.order.update({
              where: { orderId },
              data: {
                totalAmount: { increment: pkgPrice },
                note: existingNote ? `${existingNote} | ${renewNote}` : renewNote,
              },
            });
          }

          await prisma.customer.update({
            where: { id: order.customerId },
            data: { renewPending: true },
          });
        }
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
        sendCustomerPush(orderWithCustomer.customer.id, {
          title: "ซักเสร็จแล้ว!",
          body: `ออเดอร์ ${orderId} พร้อมแล้ว — กดจองเวลานัดรับ-ส่ง`,
          url: "/my?tab=booking",
        }).catch(() => {});
      }
    }

    // Forgot-items: push to LINE only when NEW photos were added (compared to existing)
    if (checkPhotos !== undefined) {
      try {
        const newUrls: string[] = checkPhotos ? JSON.parse(checkPhotos) : [];
        if (Array.isArray(newUrls) && newUrls.length > 0) {
          const existingOrder = await prisma.order.findUnique({
            where: { orderId },
            include: { customer: true },
          });
          let oldUrls: string[] = [];
          try {
            oldUrls = existingOrder?.checkPhotos ? JSON.parse(existingOrder.checkPhotos) : [];
          } catch { /* old field malformed */ }
          const oldSet = new Set(oldUrls);
          const added = newUrls.filter((u) => !oldSet.has(u));
          if (added.length > 0 && existingOrder?.customer?.lineUserId) {
            const message = `📸 พบสิ่งของในเสื้อผ้าของคุณ\n\nออเดอร์: ${orderId}\nทางร้านพบสิ่งของในกระเป๋าเสื้อผ้า รบกวนตรวจสอบและรับคืนได้ที่ร้านครับ`;
            pushTextWithImages(existingOrder.customer.lineUserId, message, added).catch(
              (err) => console.error("Failed to send LINE forgot-items notification:", err)
            );
          }
        }
      } catch {
        // checkPhotos is not valid JSON — ignore
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
      include: { items: true, customer: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Calculate how many package items this order had consumed so we can refund
    let refund = 0;
    if (order.customerId && order.items.length > 0) {
      const itemNames = order.items.map((i) => i.itemName);
      const serviceItems = await prisma.serviceItem.findMany({
        where: { name: { in: itemNames }, inPackage: true, active: true },
      });
      const svcMap = new Map(serviceItems.map((s) => [s.name, s.packageDeduction]));
      for (const item of order.items) {
        const ded = svcMap.get(item.itemName);
        if (ded) refund += item.quantity * ded;
      }
    }

    // Delete items first, then order
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { orderId } });

    // Refund the package deduction back to the customer
    if (refund > 0 && order.customerId) {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { remaining: { increment: refund } },
      });
    }

    // Notify customer on LINE that the order was cancelled
    if (order.customer?.lineUserId) {
      const refundLine = refund > 0
        ? `\nยอดแพ็คเกจคืนกลับ ${refund} ชิ้น`
        : "";
      const message = `❌ ยกเลิกออเดอร์\n\nออเดอร์: ${orderId}\nทางร้านได้ยกเลิกออเดอร์นี้แล้วครับ${refundLine}\n\nหากมีข้อสงสัย ติดต่อทางร้านได้เลยครับ 🙏`;
      pushTextMessage(order.customer.lineUserId, message).catch((err) =>
        console.error("Failed to send LINE cancel notification:", err)
      );
    }

    return NextResponse.json({ success: true, refunded: refund });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
