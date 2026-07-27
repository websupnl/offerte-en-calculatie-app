import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

function ownershipWhere(session: { user: { id: string; activeCompanyId?: string } }) {
  return {
    OR: [
      ...(session.user.activeCompanyId ? [{ companyId: session.user.activeCompanyId }] : []),
      { companyId: null, ownerId: session.user.id },
    ],
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.taskList.findFirst({ where: { id, ...ownershipWhere(session) }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Lijst niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const list = await prisma.taskList.update({
    where: { id },
    data: {
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
      sortOrder: parsed.data.sortOrder,
      archivedAt: parsed.data.archived === undefined ? undefined : parsed.data.archived ? new Date() : null,
    },
  });

  return NextResponse.json(list);
}

/**
 * Lijst weghalen laat de taken bestaan (listId wordt null via SetNull) — je
 * verliest dus nooit werk door een lijst op te ruimen.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.taskList.findFirst({ where: { id, ...ownershipWhere(session) }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Lijst niet gevonden" }, { status: 404 });

  await prisma.taskList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
