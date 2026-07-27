import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  visibility: z.enum(["INTERNAL", "SHARED"]).optional(),
});

const noteInclude = {
  project: { select: { id: true, number: true, title: true } },
  customer: { select: { id: true, name: true } },
  _count: { select: { attachments: true } },
} as const;

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
  const existing = await prisma.note.findFirst({
    where: { id, deletedAt: null, ...ownershipWhere(session) },
    select: { id: true, companyId: true },
  });
  if (!existing) return NextResponse.json({ error: "Notitie niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (!existing.companyId && (data.projectId || data.customerId)) {
    return NextResponse.json({ error: "Privénotities kunnen niet aan zakelijke items gekoppeld worden" }, { status: 400 });
  }
  if (existing.companyId && data.projectId) {
    const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId: existing.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }
  if (existing.companyId && data.customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId: existing.companyId }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }

  const note = await prisma.note.update({
    where: { id },
    data: {
      title: data.title === undefined ? undefined : data.title?.trim() || null,
      body: data.body,
      pinned: data.pinned,
      projectId: data.projectId,
      customerId: data.customerId,
      visibility: data.visibility,
    },
    include: noteInclude,
  });

  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.note.findFirst({
    where: { id, deletedAt: null, ...ownershipWhere(session) },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Notitie niet gevonden" }, { status: 404 });

  await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
