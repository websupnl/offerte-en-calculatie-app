/**
 * Web Push. Werkt op Android/desktop meteen, en op iOS 16.4+ zodra de app op
 * het beginscherm staat — vandaar dat de PWA en push bij elkaar horen.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:info@websup.nl",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/**
 * Stuurt naar alle apparaten van een gebruiker. Abonnementen die 404/410
 * teruggeven zijn dood (app verwijderd, browser opgeschoond) en ruimen we op —
 * anders blijf je eeuwig naar een verdwenen telefoon pushen.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.id);
        else console.error("[push] versturen mislukt:", error);
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }

  return delivered;
}
