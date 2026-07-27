import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured, sendPushToUser } from "@/lib/push";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  return NextResponse.json({
    configured: pushConfigured(),
    devices: count,
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Ongeldige aanmelding" }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });

  // Meteen een testmelding, anders weet je niet of het écht werkt.
  await sendPushToUser(session.user.id, {
    title: "Meldingen staan aan",
    body: "Je krijgt vanaf nu een seintje bij nieuwe klantfeedback.",
    url: "/dashboard",
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, ...(endpoint ? { endpoint } : {}) },
  });

  return NextResponse.json({ ok: true });
}
