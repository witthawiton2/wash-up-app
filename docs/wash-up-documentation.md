# WASH UP - Laundry Management System
## คู่มือการใช้งานและเอกสาร Technical

---

# สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [การติดตั้งและ Setup](#2-การติดตั้งและ-setup)
3. [คู่มือการใช้งาน — แอดมิน/ผู้จัดการ](#3-คู่มือการใช้งาน--แอดมินผู้จัดการ)
4. [คู่มือการใช้งาน — พนักงานทั่วไป (Staff)](#4-คู่มือการใช้งาน--พนักงานทั่วไป)
5. [คู่มือการใช้งาน — พนักงานรับส่ง (Driver)](#5-คู่มือการใช้งาน--พนักงานรับส่ง)
6. [คู่มือการใช้งาน — ลูกค้า (Customer Portal)](#6-คู่มือการใช้งาน--ลูกค้า)
7. [ขั้นตอนการทำงานหลัก (Workflow)](#7-ขั้นตอนการทำงานหลัก)
8. [Technical Documentation](#8-technical-documentation)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [การ Deploy และ Maintenance](#11-การ-deploy-และ-maintenance)

---

# 1. ภาพรวมระบบ

## 1.1 Wash Up คืออะไร
ระบบจัดการร้านซักรีดผ้า Wash Up เป็น Web Application สำหรับ:
- จัดการออเดอร์ซักรีด (สร้าง, แก้ไข, ติดตามสถานะ)
- จัดการลูกค้าและแพ็คเกจสมาชิก
- จัดการจัดส่ง (Delivery)
- ปริ้นใบเสร็จ + ส่งใบเสร็จผ่าน LINE
- ลูกค้าดูข้อมูลตัวเอง เติมแพ็คเกจ จองคิวผ่าน LINE

## 1.2 ผู้ใช้งาน (Roles)
| Role | สิทธิ์ | เมนูที่เข้าถึงได้ |
|------|--------|-------------------|
| **Admin (ผู้จัดการ)** | เข้าถึงทุกเมนู | Dashboard, Customer, Delivery, Laundry, Ironing, Services, Packages, Bookings, Users, Summary |
| **Staff (พนง.ทั่วไป)** | จัดการออเดอร์ + ลูกค้า | Customer, Laundry, Ironing, Services, Bookings |
| **Driver (พนง.รับส่ง)** | จัดส่งเท่านั้น | Delivery |

## 1.3 เทคโนโลยีที่ใช้
- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Supabase production / Local dev)
- **ORM:** Prisma
- **LINE Integration:** LINE LIFF + Messaging API
- **Hosting:** Vercel
- **Icons:** Lucide React
- **PWA:** Manifest + Service Worker

---

# 2. การติดตั้งและ Setup

## 2.1 ติดตั้ง Development
```bash
# Clone repo
git clone https://github.com/witthawiton2/wash-up-app.git
cd wash-up-app

# Install dependencies
npm install

# สร้าง local database (ต้องมี PostgreSQL)
createdb washup_dev

# สร้าง .env.local
echo 'DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/washup_dev"' > .env.local
echo 'DIRECT_URL="postgresql://YOUR_USERNAME@localhost:5432/washup_dev"' >> .env.local

# Push schema ไป local DB
npx prisma db push

# Seed ข้อมูลตัวอย่าง
npm run seed

# รัน dev server
npm run dev
```

## 2.2 Environment Variables (.env)
| ตัวแปร | คำอธิบาย | ตัวอย่าง |
|--------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooler) | `postgresql://...@pooler.supabase.com:6543/postgres` |
| `DIRECT_URL` | PostgreSQL direct connection | `postgresql://...@supabase.com:5432/postgres` |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token | `f7d80T2+...` |
| `NEXT_PUBLIC_BASE_URL` | URL ของเว็บ (สำหรับ receipt image) | `https://wash-up-app.vercel.app` |
| `NEXT_PUBLIC_LIFF_ID` | LINE LIFF ID | `2008067718-xdvXoaP2` |
| `PROMPTPAY_ACCOUNT` | เลขบัญชี PromptPay | `0431839954` |
| `PROMPTPAY_NAME` | ชื่อบัญชี | `นส.หฤทัย หะมูซอ` |
| `ADMIN_LINE_USER_ID` | LINE userId ของแอดมิน (สำหรับแจ้งเตือน) | `U1234...` |

## 2.3 บัญชีทดสอบ
| Username | Password | Role |
|----------|----------|------|
| admin | 1234 | ผู้จัดการ |
| staff | 1234 | พนง.ทั่วไป |
| driver | 1234 | พนง.รับส่ง |

---

# 3. คู่มือการใช้งาน — แอดมิน/ผู้จัดการ

## 3.1 Dashboard
- แสดงสรุปข้อมูลทั้งหมด: ออเดอร์วันนี้, รายได้วันนี้, จองวันนี้, รอเติมแพ็คเกจ
- กราฟรายได้ 7 วันล่าสุด + กราฟจำนวนออเดอร์
- สัดส่วนสถานะ, รายการยอดนิยม, ลูกค้า Top 5
- ออเดอร์ล่าสุด 5 รายการ

## 3.2 จัดการลูกค้า (Customer)
**แท็บ:**
- ทั้งหมด — แสดงลูกค้าทุกคน
- รอยืนยัน — ลูกค้าที่สมัครใหม่หรือขอเติมแพ็คเกจ

**การดำเนินการ:**
1. **เพิ่มลูกค้า** → กด "+ เพิ่มลูกค้าใหม่" → กรอกชื่อ, เบอร์โทร, ที่อยู่, เลือกแพ็คเกจ
2. **ยืนยันลูกค้าใหม่** → แท็บ "รอยืนยัน" → กดปุ่ม "ยืนยัน"
3. **เติมแพ็คเกจ** → กดปุ่ม "เติมแพ็คเกจ" → ดูสลิป → ยืนยัน
4. **ตั้งรหัสลูกค้า** → แก้ไข → กรอก "รหัสลูกค้า"
5. **ค้นหา** → พิมพ์ชื่อ/เบอร์/รหัสในช่องค้นหา

## 3.3 จัดการรายการสินค้า (Services)
- เพิ่ม/แก้ไข/ลบ รายการบริการ (เสื้อ, กางเกง, ฯลฯ)
- ตั้งราคา, หมวดหมู่ (ในแพ็คเกจ/ซักอบรีด/ซักแห้ง/รีด/ซักพับ)
- ตั้งชื่อภาษาอังกฤษ
- ตั้งค่า "อยู่ในแพ็คเกจ" + จำนวนตัดแพ็คเกจต่อชิ้น

## 3.4 จัดการแพ็คเกจ (Packages)
- เพิ่ม/แก้ไข แพ็คเกจ (ชื่อ, จำนวนชิ้น, วันที่ใช้ได้, ราคา)
- ตัวอย่าง: S (30 ชิ้น/60 วัน/700฿), M (40 ชิ้น/60 วัน/850฿)

## 3.5 จัดการผู้ใช้ (Users)
- เพิ่ม/แก้ไข/ลบ ผู้ใช้ (admin, staff, driver)
- เปิด/ปิดการใช้งาน

## 3.6 สรุป (Summary)
- รายงานรายวัน: รายได้, จำนวนออเดอร์, จำนวนชิ้น
- รายการผ้ายอดนิยม
- ปุ่ม Export CSV (ออเดอร์ / ลูกค้า)

## 3.7 การจอง (Bookings)
- แสดงรายการจองทั้งหมดจากลูกค้า
- ข้อมูล: เลขออเดอร์, ลูกค้า, วันที่จอง, เวลา, สถานะ

---

# 4. คู่มือการใช้งาน — พนักงานทั่วไป

## 4.1 สร้างออเดอร์ซัก (Laundry)
1. กด **"+ เพิ่มออเดอร์ซัก"**
2. เลขออเดอร์จะรันอัตโนมัติ (000001, 000002, ...)
3. **เลือกลูกค้า** — dropdown ค้นหาได้ / หรือพิมพ์ชื่อลูกค้าทั่วไป
4. **เลือกรายการผ้า:**
   - กดปุ่มหมวด (แพ็คเกจ / ซักอบรีด / ซักแห้ง / รีด / ซักพับ)
   - เลือกรายการจาก dropdown
   - ตั้งจำนวนและราคา
   - กด "+ เพิ่มรายการ" เพื่อเพิ่มผ้าอีกชิ้น
5. **ไม้แขวน** — กรอกจำนวนไม้แขวนที่มี/ซื้อ (5฿/อัน)
6. **ส่วนลด** — กรอก % หรือกดปุ่ม 5% / 10%
7. **ถ่ายรูปตรวจกระเป๋า** — ถ่ายรูปของที่ลืมในกระเป๋า
8. **หมายเหตุ** — กรอกถ้ามี
9. กด **"บันทึก"**

**หลังบันทึก:**
- ระบบจะส่งใบเสร็จผ่าน LINE ให้ลูกค้าอัตโนมัติ
- ถ้าเปิด Auto Print → ปริ้นบิลอัตโนมัติ
- ตัดจำนวนชิ้นจากแพ็คเกจลูกค้า (ถ้ามี)
- แจ้งเตือน LINE ถ้ายอดแพ็คเกจเหลือ < 10 ชิ้น

## 4.2 เปลี่ยนสถานะ "พร้อมส่ง"
- กดปุ่ม **"พร้อมส่ง"** ในรายการ → สถานะเปลี่ยนเป็น "พร้อมส่ง"
- ระบบส่ง LINE แจ้งลูกค้าว่าซักเสร็จ + ลิงก์จองคิว

## 4.3 แก้ไขออเดอร์
- กดปุ่ม **"แก้ไข"** (เฉพาะสถานะ "รอซักรีด")
- แก้รายการ/จำนวน → บันทึก → ส่ง LINE ใบเสร็จแก้ไขอัตโนมัติ

## 4.4 ปริ้นบิล / ดูบิล / ส่ง LINE
- **ปริ้นบิล** → เปิด print dialog (กระดาษ 80mm)
- **บิล** → ดูตัวอย่างใบเสร็จ
- **ส่ง LINE** → ส่งรูปใบเสร็จไปทาง LINE

## 4.5 Auto Print
- กดปุ่ม 🖨️ **Auto Print** ที่มุมขวาบน
- เขียว = เปิด (ปริ้นอัตโนมัติหลังสร้างออเดอร์)
- เทา = ปิด

## 4.6 รีดผ้า (Ironing)
1. เข้าหน้า **Ironing**
2. แสดงออเดอร์ทั้งหมดเป็น card
3. ติ๊ก checkbox แต่ละรายการที่รีดเสร็จ
4. เมื่อติ๊กครบ → กดปุ่ม **"รีดเสร็จ → พร้อมส่ง"**
5. สถานะเปลี่ยนเป็น "พร้อมส่ง"

---

# 5. คู่มือการใช้งาน — พนักงานรับส่ง

## 5.1 จัดส่ง (Delivery)
1. เข้าหน้า **Delivery**
2. แสดงรายการที่สถานะ "พร้อมส่ง" และ "ส่งแล้ว"
3. **ส่งเสร็จ:**
   - กดปุ่ม **"ส่งเสร็จ"**
   - ถ่ายรูปหลักฐานการส่ง (หลายรูปได้)
   - กด **"ยืนยันส่งเสร็จ"**
4. สถานะเปลี่ยนเป็น "ส่งแล้ว"
5. ระบบส่ง LINE แจ้งลูกค้าว่าส่งแล้ว

---

# 6. คู่มือการใช้งาน — ลูกค้า

## 6.1 สมัครสมาชิก
1. ลูกค้าเปิดลิงก์ LINE LIFF → ไปหน้า `/register`
2. กรอก: ชื่อ, นามสกุล, เบอร์โทร, LINE ID, ที่อยู่
3. เลือกแพ็คเกจ
4. กด "ลงทะเบียน"
5. **รอแอดมินยืนยัน** → หลังยืนยัน จำนวนชิ้นจะถูกเพิ่ม

## 6.2 Customer Portal (/my)
ลูกค้าเดิมเปิดลิงก์ → redirect ไป `/my` อัตโนมัติ

**Tab รายการ:**
- ดูออเดอร์ทั้งหมด + สถานะ

**Tab เติมแพ็คเกจ:**
1. เลือกแพ็คเกจ
2. สแกน QR PromptPay ชำระเงิน
3. ถ่ายรูปสลิป
4. กด "ส่งคำขอเติมแพ็คเกจ"
5. รอแอดมินยืนยัน

**Tab จองคิว:**
1. เลือกกิจกรรม (ส่งผ้าซัก / รับผ้าคืน)
2. ถ้ารับผ้าคืน → เลือกออเดอร์
3. เลือกช่วงเวลา (เช้า/บ่าย/เย็น)
4. เลือกวันที่
5. เลือกเวลา
6. กรอกเบอร์โทร + หมายเหตุ
7. กด "จอง"

---

# 7. ขั้นตอนการทำงานหลัก (Workflow)

```
ลูกค้าสมัครสมาชิก (/register)
        ↓
แอดมินยืนยัน (Customer → รอยืนยัน)
        ↓
พนักงานรับผ้า → สร้างออเดอร์ (Laundry)
  สถานะ: "รอซักรีด"
  → ส่ง LINE บิล + ปริ้นบิล
  → ตัดจำนวนแพ็คเกจ
        ↓
พนักงานรีดผ้า (Ironing)
  → ติ๊ก checkbox แต่ละรายการ
  → กดยืนยัน
  สถานะ: "พร้อมส่ง"
  → ส่ง LINE แจ้งลูกค้า + ลิงก์จองคิว
        ↓
ลูกค้าจองคิวรับผ้า (/my → จองคิว)
  → แอดมินดูที่หน้า Bookings
        ↓
พนักงานจัดส่ง (Delivery)
  → ถ่ายรูปหลักฐาน
  → กดส่งเสร็จ
  สถานะ: "ส่งแล้ว"
  → ส่ง LINE แจ้งลูกค้า
```

## 7.1 แจ้งเตือน LINE อัตโนมัติ
| เหตุการณ์ | ส่งถึง | ข้อความ |
|-----------|--------|---------|
| สร้างออเดอร์ | ลูกค้า | ใบเสร็จ (รูปภาพ) |
| แก้ไขออเดอร์ | ลูกค้า | ใบเสร็จแก้ไข (รูปภาพ) |
| ซักเสร็จ (พร้อมส่ง) | ลูกค้า | ข้อความ + ลิงก์จองคิว |
| จัดส่งเสร็จ | ลูกค้า | ข้อความ + รูปหลักฐาน |
| ยอดแพ็คเกจ < 10 | ลูกค้า | แจ้งเตือนเติมแพ็คเกจ |
| แพ็คเกจหมดอายุ | ลูกค้า | แจ้งเตือนต่ออายุ |
| สมัครสมาชิกใหม่ | แอดมิน | แจ้งเตือนยืนยัน |
| ขอเติมแพ็คเกจ | แอดมิน | แจ้งเตือนตรวจสลิป |
| จองคิวใหม่ | แอดมิน | แจ้งเตือนการจอง |

---

# 8. Technical Documentation

## 8.1 Project Structure
```
wash-up-app/
├── app/
│   ├── api/                  # API Routes
│   │   ├── auth/login/       # Login API
│   │   ├── bookings/         # Bookings API
│   │   ├── customers/        # Customer CRUD
│   │   ├── deliveries/       # Delivery API
│   │   ├── export/           # CSV Export
│   │   ├── line/send-receipt/# LINE send receipt
│   │   ├── my/orders/        # Customer portal orders
│   │   ├── my/booking/       # Customer booking
│   │   ├── notifications/    # Badge counts
│   │   ├── orders/           # Order CRUD
│   │   ├── packages/         # Package CRUD
│   │   ├── promptpay-qr/     # QR generation
│   │   ├── receipt/[orderId]/# Receipt image
│   │   ├── register/         # Customer registration
│   │   ├── renew/            # Package renewal
│   │   ├── service-items/    # Service item CRUD
│   │   ├── summary/          # Dashboard summary
│   │   ├── upload/           # File upload
│   │   └── users/            # User CRUD
│   ├── dashboard/            # Admin dashboard pages
│   │   ├── bookings/
│   │   ├── customer/
│   │   ├── delivery/
│   │   ├── ironing/
│   │   ├── laundry/
│   │   ├── packages/
│   │   ├── services/
│   │   ├── summary/
│   │   ├── users/
│   │   └── page.tsx          # Main dashboard
│   ├── login/
│   ├── my/                   # Customer portal
│   ├── register/             # LINE LIFF registration
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── DashboardLayout.tsx
│   ├── ErrorBoundary.tsx
│   ├── Modal.tsx
│   ├── Pagination.tsx
│   ├── PWARegister.tsx
│   ├── Sidebar.tsx
│   └── Spinner.tsx
├── lib/
│   ├── api-auth.ts           # API authentication
│   ├── audit.ts              # Audit logging
│   ├── auth-context.tsx      # React auth context
│   ├── base-url.ts
│   ├── i18n.ts               # Internationalization
│   ├── line-api.ts           # LINE Messaging API
│   ├── notify-admin.ts       # Admin LINE notifications
│   ├── print-settings.ts     # Print configuration
│   ├── prisma.ts             # Prisma client
│   ├── promptpay-qr.ts       # PromptPay QR generator
│   ├── qr-data.ts            # QR data URI
│   ├── rate-limit.ts         # Rate limiting
│   └── use-polling.ts        # Auto-refresh hook
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data
├── public/
│   ├── icons/                # PWA icons
│   ├── images/
│   ├── manifest.json         # PWA manifest
│   └── sw.js                 # Service Worker
├── scripts/
│   └── backup.sh             # DB backup script
├── middleware.ts              # Rate limiting middleware
└── .github/workflows/ci.yml  # CI/CD
```

## 8.2 Authentication Flow
```
1. User → POST /api/auth/login { username, password }
2. Server → ตรวจ password (bcrypt hash หรือ plain text)
3. Server → return { username, name, role }
4. Client → เก็บใน sessionStorage ("washup_user")
5. AuthContext → อ่านจาก sessionStorage
6. DashboardLayout → redirect ไป /login ถ้าไม่มี user
7. Sidebar → filter menu ตาม role
```

## 8.3 Order Status Flow
```
รอซักรีด → พร้อมส่ง → ส่งแล้ว
```

## 8.4 Package Deduction Logic
1. สร้างออเดอร์ → ดู ServiceItem.inPackage
2. ถ้า inPackage && ลูกค้ามีแพ็คเกจ → ราคา = 0, ตัด qty * packageDeduction จาก customer.remaining
3. แก้ไขออเดอร์ → คำนวณส่วนต่าง (เพิ่ม/ลด) แล้วปรับ remaining

## 8.5 Receipt Generation
- API: `GET /api/receipt/{orderId}`
- ใช้ `@vercel/og` (Satori) สร้างรูป PNG จาก JSX
- รองรับ QR Code PromptPay พร้อมยอดเงิน
- ขนาด 500px width, ความสูงตามจำนวนรายการ

## 8.6 Real-time Features
- **Polling:** ทุก 30 วินาที (usePolling hook)
- **Notification Badge:** Sidebar แสดงจำนวนรอดำเนินการ refresh ทุก 30 วินาที

## 8.7 Security
- **Password:** bcrypt hash (รองรับ plain text ในช่วง migration)
- **Rate Limiting:** 120 requests/นาที/IP (middleware.ts)
- **Error Boundary:** จับ error ไม่ให้หน้าค้างขาว

---

# 9. Database Schema

## 9.1 ตาราง
| Model | คำอธิบาย |
|-------|---------|
| User | ผู้ใช้ระบบ (admin, staff, driver) |
| Customer | ลูกค้า |
| Order | ออเดอร์ซักรีด |
| OrderItem | รายการผ้าในออเดอร์ |
| Delivery | ข้อมูลจัดส่ง |
| ServiceItem | รายการบริการ (เสื้อ, กางเกง, ฯลฯ) |
| Package | แพ็คเกจสมาชิก (S, M, L) |
| Payment | ประวัติการชำระเงิน |
| AuditLog | ประวัติการดำเนินการ |
| Promotion | โปรโมชัน (ยังไม่ใช้งาน) |

## 9.2 ความสัมพันธ์
```
Customer 1→N Order
Order 1→N OrderItem
Order 1→1 Delivery
Customer 1→N Payment
```

---

# 10. API Reference

## 10.1 Authentication
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| POST | /api/auth/login | เข้าสู่ระบบ |

## 10.2 Orders
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | /api/orders | ดึงออเดอร์ทั้งหมด |
| POST | /api/orders | สร้างออเดอร์ |
| PUT | /api/orders | แก้ไขออเดอร์/เปลี่ยนสถานะ |
| DELETE | /api/orders?orderId=xxx | ลบออเดอร์ |

## 10.3 Customers
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | /api/customers | ดึงลูกค้าทั้งหมด |
| POST | /api/customers | เพิ่มลูกค้า |
| PUT | /api/customers | แก้ไขลูกค้า |
| DELETE | /api/customers?id=xxx | ลบลูกค้า |
| POST | /api/customers/approve | ยืนยันลูกค้า |

## 10.4 Delivery
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | /api/deliveries | ดึงรายการจัดส่ง |
| PUT | /api/deliveries | อัพเดตสถานะจัดส่ง |

## 10.5 Others
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | /api/service-items | รายการบริการ |
| GET | /api/packages | แพ็คเกจ |
| GET | /api/users | ผู้ใช้ |
| GET | /api/summary | ข้อมูลสรุป Dashboard |
| GET | /api/bookings | รายการจอง |
| GET | /api/notifications | จำนวน badge |
| GET | /api/export?type=orders | Export CSV |
| GET | /api/receipt/{orderId} | รูปใบเสร็จ |
| POST | /api/register | สมัครสมาชิก |
| POST | /api/renew | เติมแพ็คเกจ |
| POST | /api/my/booking | จองคิว |
| POST | /api/upload | อัพโหลดรูป |
| POST | /api/line/send-receipt | ส่งใบเสร็จ LINE |

---

# 11. การ Deploy และ Maintenance

## 11.1 Deploy to Vercel
```bash
# Build
npm run build

# Deploy
vercel --prod --yes
```

## 11.2 Push Schema to Production
```bash
npx prisma db push
```

## 11.3 Backup Database
```bash
npm run backup
```
ไฟล์ backup จะอยู่ที่ `./backups/washup_backup_YYYYMMDD_HHMMSS.sql.gz`

## 11.4 Seed Data
```bash
npm run seed
```

## 11.5 CI/CD (GitHub Actions)
- Push ไป `main` → auto build + type check + deploy to Vercel
- ต้องตั้ง GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

---

*เอกสารนี้อัพเดตล่าสุด: เมษายน 2569*
*Wash Up Laundry Management System v1.0*
