// Localized error messages for customer-facing API routes.
// Clients signal language via the X-Lang header; routes call apiError(...)
// to produce a response in the right language.

import { NextRequest, NextResponse } from "next/server";

export type Lang = "th" | "en";

export function getRequestLang(request: NextRequest): Lang {
  const raw = request.headers.get("x-lang")?.toLowerCase();
  return raw === "en" ? "en" : "th";
}

type Key =
  | "customer_not_found"
  | "order_not_found"
  | "missing_fields"
  | "generic_error"
  | "invalid_slip_url"
  | "no_file"
  | "invalid_file_type"
  | "file_too_large"
  | "upload_failed"
  | "duplicate_phone"
  | "duplicate_email"
  | "booking_failed"
  | "cancel_failed"
  | "slot_full"
  | "booking_too_soon";

const MESSAGES: Record<Lang, Record<Key, string>> = {
  th: {
    customer_not_found: "ไม่พบข้อมูลลูกค้า กรุณาลงทะเบียนก่อน",
    order_not_found: "ไม่พบออเดอร์",
    missing_fields: "กรุณากรอกข้อมูลให้ครบถ้วน",
    generic_error: "เกิดข้อผิดพลาด กรุณาลองใหม่",
    invalid_slip_url: "ลิงก์สลิปไม่ถูกต้อง",
    no_file: "ไม่พบไฟล์",
    invalid_file_type: "อนุญาตเฉพาะไฟล์รูปภาพ",
    file_too_large: "ขนาดไฟล์ต้องไม่เกิน 5MB",
    upload_failed: "อัพโหลดไฟล์ไม่สำเร็จ",
    duplicate_phone: "เบอร์โทรนี้ลงทะเบียนแล้ว",
    duplicate_email: "อีเมลนี้ลงทะเบียนแล้ว",
    booking_failed: "จองคิวไม่สำเร็จ",
    cancel_failed: "ยกเลิกคิวไม่สำเร็จ",
    slot_full: "ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น",
    booking_too_soon: "การรับผ้าคืนต้องจองล่วงหน้าอย่างน้อย 1 ชั่วโมง กรุณาเลือกเวลาอื่น",
  },
  en: {
    customer_not_found: "Customer not found — please register first",
    order_not_found: "Order not found",
    missing_fields: "Please fill in all required fields",
    generic_error: "Something went wrong, please try again",
    invalid_slip_url: "Invalid slip URL",
    no_file: "No file uploaded",
    invalid_file_type: "Only image files are allowed",
    file_too_large: "File size must be less than 5MB",
    upload_failed: "Failed to upload file",
    duplicate_phone: "This phone number is already registered",
    duplicate_email: "This email is already registered",
    booking_failed: "Booking failed",
    cancel_failed: "Could not cancel booking",
    slot_full: "This slot is full — please pick another time",
    booking_too_soon: "Pickups must be booked at least 1 hour in advance — please pick another time",
  },
};

export function apiError(lang: Lang, key: Key, status: number) {
  return NextResponse.json({ error: MESSAGES[lang][key] }, { status });
}
