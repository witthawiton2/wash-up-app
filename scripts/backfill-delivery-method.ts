import { PrismaClient } from "@prisma/client";
import { extractMethodFromNote } from "../lib/booking-slots";

// One-time backfill: derive Order.deliveryMethod from the "วิธี: ..." segment
// stored in Order.note by older bookings. Going forward /api/my/booking sets
// the column directly, so slot-availability and cap enforcement can count on
// the column instead of re-parsing note text.
//
// Run against the target DB, e.g.:
//   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-delivery-method.ts
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { deliveryMethod: null, requestedDeliveryDate: { not: null } },
    select: { id: true, orderId: true, note: true },
  });

  let updated = 0;
  for (const o of orders) {
    const method = extractMethodFromNote(o.note);
    if (!method) continue;
    await prisma.order.update({
      where: { id: o.id },
      data: { deliveryMethod: method },
    });
    updated += 1;
    console.log(`  ✓ ${o.orderId}  →  ${method}`);
  }

  console.log(`\nBackfilled deliveryMethod on ${updated} order(s) (scanned ${orders.length} with a booking date).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
