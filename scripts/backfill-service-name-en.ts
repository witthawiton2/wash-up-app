import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NAME_EN: Record<string, string> = {
  // รายการในแพ็คเกจ / รายการซักอบรีด
  "เสื้อ": "Shirt",
  "กางเกง": "Pants",
  "กระโปรง": "Skirt",
  "ชุดแซค/เดรส(สั้น)": "Short Dress",
  "ชุดแซค/เดรส(ยาว)": "Long Dress",
  "ชุดชั้นใน": "Underwear",
  "ถุงเท้า 1 คู่": "Socks (pair)",
  "ผ้าเช็ดตัว(เล็ก)": "Small Towel",
  "ผ้าเช็ดตัว(ปกติ)": "Towel",
  "ผ้าเช็ดตัว(ใหญ่)": "Large Towel",
  "ปลอกหมอน": "Pillowcase",
  "ผ้าปูที่นอน3.5ฟุต": "Bed Sheet 3.5ft",
  "ผ้าปูที่นอน5ฟุต": "Bed Sheet 5ft",
  "ผ้าปูที่นอน6ฟุต": "Bed Sheet 6ft",
  "ผ้าห่ม": "Blanket",
  "ผ้านวม": "Comforter",
  "ท๊อปเปอร์ที่นอน": "Mattress Topper",
  // รายการซักแห้ง / รายการรีดอย่างเดียว
  "เสื้อเชิ้ตแขนยาว": "Long Sleeve Shirt",
  "เสื้อเชิ้ตแขนสั้น": "Short Sleeve Shirt",
  "เสื้อยืดแขนยาว": "Long Sleeve T-Shirt",
  "เสื้อยืดแขนสั้น": "Short Sleeve T-Shirt",
  "เสื้อยืด": "T-Shirt",
  "กางเกงขายาว": "Long Pants",
  "กางเกงขาสั้น": "Shorts",
  "เสื้อเบรเซอร์": "Blazer",
  "สูท2ชิ้น": "2-Piece Suit",
  "สูท3ชิ้น": "3-Piece Suit",
  "เสื้อกันหนาว1": "Light Jacket",
  "เสื้อกันหนาว2": "Heavy Jacket",
  "เสื้อกันหนาว": "Jacket",
  "แจคเก็ต1": "Jacket (light)",
  "แจคเก็ต2": "Jacket (heavy)",
  "โค้ท1": "Coat (light)",
  "โค้ท2": "Coat (heavy)",
  "โอเวอร์โค้ท": "Overcoat",
  "สเวตเตอร์1": "Sweater (light)",
  "สเวตเตอร์2": "Sweater (heavy)",
  "ชุดราตรี1": "Evening Gown (light)",
  "ชุดราตรี2": "Evening Gown (heavy)",
  "ชุดแซค/เดรส": "Dress",
  "กระโปรงยาว": "Long Skirt",
  "กระโปรงสั้น": "Short Skirt",
  "เสื้อสูท": "Suit Jacket",
  "ถุงมือ": "Gloves",
  "ผ้าพันคอ": "Scarf",
  "เนคไท": "Necktie",
  "หมวกไหมพรม": "Knit Hat",
  "กางเกงยีนส์": "Jeans",
  "กางเกงใน": "Underwear (briefs)",
  "ผ้ารองที่นอน": "Mattress Pad",
  "ผ้าปูที่นอน": "Bed Sheet",
  // ซัก อบ พับ
  "ซัก อบ พับ": "Wash Dry Fold",
};

async function main() {
  const items = await prisma.serviceItem.findMany({
    select: { id: true, name: true, nameEn: true, category: true },
  });

  let updated = 0;
  const missing: { id: number; name: string; category: string }[] = [];

  for (const item of items) {
    if (item.nameEn && item.nameEn.trim()) continue;
    const en = NAME_EN[item.name];
    if (!en) {
      missing.push({ id: item.id, name: item.name, category: item.category });
      continue;
    }
    await prisma.serviceItem.update({
      where: { id: item.id },
      data: { nameEn: en },
    });
    updated += 1;
    console.log(`  ✓ #${item.id}  ${item.name}  →  ${en}`);
  }

  console.log(`\nUpdated ${updated} service item(s).`);
  if (missing.length) {
    console.log(`\nNo English mapping for ${missing.length} item(s) — add to NAME_EN or set manually in /dashboard/services:`);
    for (const m of missing) {
      console.log(`  - #${m.id}  [${m.category}]  ${m.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
