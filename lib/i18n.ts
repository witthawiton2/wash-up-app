const translations: Record<string, Record<string, string>> = {
  th: {
    "dashboard": "แดชบอร์ด",
    "laundry": "ซักรีด",
    "delivery": "จัดส่ง",
    "ironing": "รีดผ้า",
    "customer": "ลูกค้า",
    "services": "รายการสินค้า",
    "packages": "แพ็คเกจ",
    "users": "ผู้ใช้",
    "summary": "สรุป",
    "bookings": "การจอง",
    "login": "เข้าสู่ระบบ",
    "logout": "ออกจากระบบ",
    "save": "บันทึก",
    "cancel": "ยกเลิก",
    "delete": "ลบ",
    "edit": "แก้ไข",
    "add": "เพิ่ม",
    "search": "ค้นหา",
    "loading": "กำลังโหลด...",
    "no_data": "ไม่มีข้อมูล",
    "total": "รวม",
    "status": "สถานะ",
    "date": "วันที่",
    "order_id": "เลขออเดอร์",
    "customer_name": "ชื่อลูกค้า",
    "phone": "โทรศัพท์",
    "address": "ที่อยู่",
    "price": "ราคา",
    "quantity": "จำนวน",
    "discount": "ส่วนลด",
    "today": "วันนี้",
    "all": "ทั้งหมด",
  },
  en: {
    "dashboard": "Dashboard",
    "laundry": "Laundry",
    "delivery": "Delivery",
    "ironing": "Ironing",
    "customer": "Customer",
    "services": "Services",
    "packages": "Packages",
    "users": "Users",
    "summary": "Summary",
    "bookings": "Bookings",
    "login": "Login",
    "logout": "Logout",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "loading": "Loading...",
    "no_data": "No data",
    "total": "Total",
    "status": "Status",
    "date": "Date",
    "order_id": "Order ID",
    "customer_name": "Customer Name",
    "phone": "Phone",
    "address": "Address",
    "price": "Price",
    "quantity": "Quantity",
    "discount": "Discount",
    "today": "Today",
    "all": "All",
  },
};

export type Lang = "th" | "en";

export function t(key: string, lang: Lang = "th"): string {
  return translations[lang]?.[key] || translations.th[key] || key;
}

export function getLang(): Lang {
  if (typeof window === "undefined") return "th";
  return (localStorage.getItem("washup_lang") as Lang) || "th";
}

export function setLang(lang: Lang) {
  localStorage.setItem("washup_lang", lang);
}
