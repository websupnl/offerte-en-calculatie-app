import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalSessionFromCookie } from "@/lib/portal";
import { sendTelegramMessage } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

const schema = z.object({
  title: z.string().min(3, "Beschrijf kort wat je bedoelt").max(300),
  description: z.string().max(5000).optional(),
});

/**
 * De klant maakt een feedbackpunt aan. Dat wordt gewoon een Task in Daans
 * takenlijst — geen aparte inbox die hij moet leegmaken en overtypen.
 */
export async function POST(req: NextRequest) {
  const access = await portalSessionFromCookie();
  if (!access) return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  if (!access.canComment) return NextResponse.json({ error: "Je mag hier niet reageren" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" }, { status: 400 });
  }

  // Eigenaar wordt de gebruiker die deze toegang heeft aangemaakt — in de
  // praktijk Daan. Zonder eigenaar kan een taak niet bestaan.
  const owner = await prisma.companyUser.findFirst({
    where: { companyId: access.companyId },
    orderBy: { role: "asc" },
    select: { userId: true },
  });
  if (!owner) return NextResponse.json({ error: "Geen ontvanger gevonden" }, { status: 500 });

  const customer = await prisma.customer.findUnique({
    where: { id: access.customerId },
    select: { name: true },
  });

  const task = await prisma.task.create({
    data: {
      companyId: access.companyId,
      ownerId: owner.userId,
      customerId: access.customerId,
      projectId: access.projectId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      status: "OPEN",
      source: "PORTAL_MESSAGE",
      visibility: "SHARED",
    },
    select: { id: true, title: true, description: true, status: true, createdAt: true, source: true },
  });

  const who = access.name ?? customer?.name ?? "Klant";
  sendTelegramMessage(`💬 <b>NIEUWE FEEDBACK</b>\n👤 ${who}\n📝 ${parsed.data.title}`).catch(console.error);
  sendPushToUser(owner.userId, {
    title: `Feedback van ${who}`,
    body: parsed.data.title,
    url: `/tasks?task=${task.id}`,
    tag: `feedback-${task.id}`,
  }).catch(console.error);

  return NextResponse.json({ ...task, comments: [] }, { status: 201 });
}
