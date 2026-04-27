import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // Users
  const users = [
    { username: "admin", password: "1234", name: "Admin Wash Up", role: "admin" },
    { username: "staff", password: "1234", name: "พนักงานซักรีด", role: "staff" },
    { username: "driver", password: "1234", name: "คนขับรถส่งผ้า", role: "driver" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: u,
    });
  }
  console.log("✓ Users seeded");

  // Packages
  const packages = [
    { name: "S", description: "5 items within 15 days", totalItems: 30, validDays: 60, price: 700 },
    { name: "M", description: "10 items within 30 days", totalItems: 40, validDays: 60, price: 850 },
    { name: "L", description: "20 items within 30 days", totalItems: 50, validDays: 60, price: 990 },
    { name: "รีดอย่างเดียว", description: "3 items within 7 days", totalItems: 50, validDays: 60, price: 850 },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }
  console.log("✓ Packages seeded");

  // Service Items
  const serviceItems = [
    // รายการในแพ็คเกจ
    { name: "เสื้อ", nameEn: "Shirt", price: 0, category: "รายการในแพ็คเกจ", inPackage: true, packageDeduction: 1 },
    { name: "กางเกง", nameEn: "Pants", price: 0, category: "รายการในแพ็คเกจ", inPackage: true, packageDeduction: 1 },
    { name: "กระโปรง", nameEn: "Skirt", price: 0, category: "รายการในแพ็คเกจ", inPackage: true, packageDeduction: 1 },
    { name: "ชุดแซค/เดรส(สั้น)", nameEn: "Short Dress", price: 0, category: "รายการในแพ็คเกจ", inPackage: true, packageDeduction: 1 },
    { name: "ชุดแซค/เดรส(ยาว)", nameEn: "Long Dress", price: 0, category: "รายการในแพ็คเกจ", inPackage: true, packageDeduction: 2 },
    // รายการซักอบรีด
    { name: "ชุดชั้นใน", nameEn: "Underwear", price: 10, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ถุงเท้า 1 คู่", nameEn: "Socks (pair)", price: 10, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าเช็ดตัว(เล็ก)", nameEn: "Small Towel", price: 10, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าเช็ดตัว(ปกติ)", nameEn: "Towel", price: 25, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าเช็ดตัว(ใหญ่)", nameEn: "Large Towel", price: 50, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ปลอกหมอน", nameEn: "Pillowcase", price: 20, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าปูที่นอน3.5ฟุต", nameEn: "Bed Sheet 3.5ft", price: 60, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าปูที่นอน5ฟุต", nameEn: "Bed Sheet 5ft", price: 70, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าปูที่นอน6ฟุต", nameEn: "Bed Sheet 6ft", price: 80, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้าห่ม", nameEn: "Blanket", price: 100, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ผ้านวม", nameEn: "Comforter", price: 150, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    { name: "ท๊อปเปอร์ที่นอน", nameEn: "Mattress Topper", price: 500, category: "รายการซักอบรีด", inPackage: false, packageDeduction: 1 },
    // รายการซักแห้ง
    { name: "เสื้อเชิ้ตแขนยาว", nameEn: "Long Sleeve Shirt", price: 90, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อเชิ้ตแขนสั้น", nameEn: "Short Sleeve Shirt", price: 80, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อยืดแขนยาว", nameEn: "Long Sleeve T-Shirt", price: 70, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "กางเกงขายาว", nameEn: "Long Pants", price: 90, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "กางเกงขาสั้น", nameEn: "Shorts", price: 80, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อเบรเซอร์", nameEn: "Blazer", price: 120, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "สูท2ชิ้น", nameEn: "2-Piece Suit", price: 200, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อกันหนาว1", nameEn: "Light Jacket", price: 200, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อกันหนาว2", nameEn: "Heavy Jacket", price: 300, category: "รายการซักแห้ง", inPackage: false, packageDeduction: 1 },
    // รายการรีดอย่างเดียว
    { name: "เสื้อเชิ้ตแขนยาว", nameEn: "Long Sleeve Shirt", price: 25, category: "รายการรีดอย่างเดียว", inPackage: false, packageDeduction: 1 },
    { name: "เสื้อเชิ้ตแขนสั้น", nameEn: "Short Sleeve Shirt", price: 20, category: "รายการรีดอย่างเดียว", inPackage: false, packageDeduction: 1 },
    { name: "กางเกงขายาว", nameEn: "Long Pants", price: 20, category: "รายการรีดอย่างเดียว", inPackage: false, packageDeduction: 1 },
    { name: "กางเกงขาสั้น", nameEn: "Shorts", price: 15, category: "รายการรีดอย่างเดียว", inPackage: false, packageDeduction: 1 },
    // ซัก อบ พับ
    { name: "ซัก อบ พับ", nameEn: "Wash Dry Fold", price: 60, category: "ซัก อบ พับ", inPackage: false, packageDeduction: 1, note: "60 บาทต่อกิโล" },
  ];

  for (const s of serviceItems) {
    await prisma.serviceItem.upsert({
      where: { name_category: { name: s.name, category: s.category } },
      update: {},
      create: {
        name: s.name,
        nameEn: s.nameEn || null,
        price: s.price,
        category: s.category,
        inPackage: s.inPackage,
        packageDeduction: s.packageDeduction,
        note: (s as { note?: string }).note || null,
      },
    });
  }
  console.log("✓ Service Items seeded");

  // Sample customer
  await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "ลูกค้าทดสอบ",
      phone: "0812345678",
      address: "123 กรุงเทพฯ",
      package: "M",
      remaining: 40,
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("✓ Sample customer seeded");

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
