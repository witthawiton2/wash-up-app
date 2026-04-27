import { prisma } from "@/lib/prisma";

export async function logAction(
  action: string,
  target?: string,
  detail?: string,
  user?: string
) {
  try {
    await prisma.auditLog.create({
      data: { action, target, detail, user },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
