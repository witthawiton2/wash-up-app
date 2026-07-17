import { prisma } from "@/lib/prisma";

// One-off: delete every laundry order and its dependent rows.
// No package refund, no LINE notification — a straight wipe.
async function main() {
  const before = await prisma.order.count();
  console.log(`Orders before: ${before}`);

  // Delete dependents first to satisfy FK constraints, then the orders.
  const deliveries = await prisma.delivery.deleteMany({});
  const items = await prisma.orderItem.deleteMany({});
  const orders = await prisma.order.deleteMany({});

  console.log(`Deleted deliveries: ${deliveries.count}`);
  console.log(`Deleted order items: ${items.count}`);
  console.log(`Deleted orders: ${orders.count}`);

  const after = await prisma.order.count();
  console.log(`Orders after: ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
