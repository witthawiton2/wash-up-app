import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

// Fan-out: loads every saved push subscription for the customer and posts the
// payload to each one in parallel. Removes endpoints that come back 404/410.
// No-op when VAPID env vars aren't configured.
export async function sendCustomerPush(
  customerId: number,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { customerId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/my",
    icon: payload.icon || "/icons/icon-192x192.png",
  });

  await Promise.all(
    subs.map(async (s) => {
      const sub: WebPushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(sub, body);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("Web push send failed:", err);
        }
      }
    }),
  );
}
