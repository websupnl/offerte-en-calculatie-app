import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalAccessByToken } from "@/lib/portal";
import { sendTelegramMessage } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

const pinSchema = z.object({
  selector: z.string().max(500),
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  pageX: z.number(),
  pageY: z.number(),
  scrollY: z.number(),
  viewport: z.string().max(20),
  url: z.string().url().max(2000),
});

const schema = z.object({
  token: z.string().min(20),
  title: z.string().min(3).max(300),
  boardId: z.string().optional(),
  pin: pinSchema,
});

/** Het widget zit op een andere host, dus CORS is nodig. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Een pin vanaf de klantsite. Wordt een gewone Task met visibility SHARED, dus
 * hij landt in dezelfde takenlijst als de rest — geen aparte inbox.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400, headers: CORS });
  }
  const { token, title, pin, boardId } = parsed.data;

  const access = await portalAccessByToken(token);
  if (!access) {
    return NextResponse.json({ error: "Deze reviewlink werkt niet meer" }, { status: 401, headers: CORS });
  }
  if (!access.canComment) {
    return NextResponse.json({ error: "Je mag hier geen feedback geven" }, { status: 403, headers: CORS });
  }

  const owner = await prisma.companyUser.findFirst({
    where: { companyId: access.companyId },
    orderBy: { role: "asc" },
    select: { userId: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Geen ontvanger gevonden" }, { status: 500, headers: CORS });
  }

  // Board mag alleen gekoppeld worden als 'ie bij hetzelfde project hoort.
  let validBoardId: string | null = null;
  if (boardId) {
    const board = await prisma.reviewBoard.findFirst({
      where: {
        id: boardId,
        companyId: access.companyId,
        ...(access.projectId ? { projectId: access.projectId } : {}),
      },
      select: { id: true },
    });
    validBoardId = board?.id ?? null;
  }

  const task = await prisma.task.create({
    data: {
      companyId: access.companyId,
      ownerId: owner.userId,
      customerId: access.customerId,
      projectId: access.projectId,
      reviewBoardId: validBoardId,
      title: title.trim(),
      status: "OPEN",
      source: "PORTAL_PIN",
      visibility: "SHARED",
      pin,
    },
    select: { id: true, title: true, createdAt: true },
  });

  const isMobile = Number(pin.viewport.split("x")[0]) < 768;
  sendTelegramMessage(
    `📍 <b>PIN OP DE SITE</b>\n👤 ${access.name ?? "Klant"}\n📝 ${title}\n🔗 ${pin.url}\n${isMobile ? "📱 Mobiel" : "💻 Desktop"} (${pin.viewport})`,
  ).catch(console.error);
  sendPushToUser(owner.userId, {
    title: `${access.name ?? "Klant"} wees iets aan`,
    body: title,
    url: `/tasks?task=${task.id}`,
    tag: `pin-${task.id}`,
  }).catch(console.error);

  return NextResponse.json(task, { status: 201, headers: CORS });
}
