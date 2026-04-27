import { pushTextMessage } from "@/lib/line-api";
import { prisma } from "@/lib/prisma";

export async function notifyAdminLine(message: string) {
  try {
    // Find all admin users with lineUserId (if admins have LINE linked)
    // For now, use ADMIN_LINE_USER_ID env var
    const adminLineId = process.env.ADMIN_LINE_USER_ID;
    if (adminLineId) {
      await pushTextMessage(adminLineId, message);
    }
  } catch (error) {
    console.error("Failed to notify admin:", error);
  }
}

export async function notifyAdminNewBooking(
  customerName: string,
  activity: string,
  date: string,
  time: string,
  orderId?: string
) {
  const msg = `📅 คำขอจองคิวใหม่!\n\nลูกค้า: ${customerName}\nกิจกรรม: ${activity}${orderId ? `\nออเดอร์: ${orderId}` : ""}\nวันที่: ${date}\nเวลา: ${time}`;
  await notifyAdminLine(msg);
}

export async function notifyAdminRenewRequest(
  customerName: string,
  packageName: string,
  price: number
) {
  const msg = `📦 คำขอเติมแพ็คเกจ!\n\nลูกค้า: ${customerName}\nแพ็คเกจ: ${packageName}\nราคา: ${price.toLocaleString()}฿\n\nกรุณาตรวจสอบสลิปที่หน้า Customer`;
  await notifyAdminLine(msg);
}

export async function notifyAdminNewRegistration(customerName: string) {
  const msg = `👤 สมัครสมาชิกใหม่!\n\nลูกค้า: ${customerName}\n\nกรุณายืนยันที่หน้า Customer`;
  await notifyAdminLine(msg);
}
