import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalScopeWhere, portalSessionFromCookie } from "@/lib/portal";
import { sendTelegramMessage } from "@/lib/notifications";

const schema = z.object({ body: z.string().min(1, "Bericht mag niet leeg zijn").max(5000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await portalSessionFromCookie();
  if (!access) return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  if (!access.canComment) return NextResponse.json({ error: "Je mag hier niet reageren" }, { status: 403 });

  const { id } = await params;

  // De taak moet binnen het bereik van deze klant vallen én gedeeld zijn.
  const task = await prisma.task.findFirst({
    where: { id, ...portalScopeWhere(access), visibility: "SHARED", deletedAt: null },
    select: { id: true, title: true },
  });
  if (!task) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: access.customerId },
    select: { name: true },
  });
  const authorName = access.name ?? customer?.name ?? "Klant";

  const comment = await prisma.comment.create({
    data: {
      taskId: id,
      authorPortalId: access.id,
      authorName,
      body: parsed.data.body.trim(),
      visibility: "SHARED", // vanuit het portaal is alles per definitie gedeeld
    },
    select: { id: true, body: true, authorName: true, createdAt: true, authorUserId: true },
  });

  sendTelegramMessage(
    `💬 <b>REACTIE VAN KLANT</b>\n👤 ${authorName}\n📌 ${task.title}\n${parsed.data.body.slice(0, 200)}`,
  ).catch(console.error);

  return NextResponse.json(comment, { status: 201 });
}
