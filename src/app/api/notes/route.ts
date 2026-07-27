import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseScope, scopeData, scopeWhere } from "@/lib/tasks";

const schema = z.object({
  scope: z.enum(["business", "private"]).default("business"),
  title: z.string().optional(),
  body: z.string().min(1, "Notitie mag niet leeg zijn"),
  projectId: z.string().nullish(),
  customerId: z.string().nullish(),
  pinned: z.boolean().optional(),
});

const noteInclude = {
  project: { select: { id: true, number: true, title: true } },
  customer: { select: { id: true, name: true } },
  _count: { select: { attachments: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const scope = parseScope(params.get("scope"));
  const search = params.get("search")?.trim();
  const projectId = params.get("projectId");

  let where;
  try {
    where = scopeWhere(scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json([], { status: 200 });
  }

  const notes = await prisma.note.findMany({
    where: {
      ...where,
      deletedAt: null,
      projectId: projectId ?? undefined,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { body: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: noteInclude,
    take: 300,
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  let scoped;
  try {
    scoped = scopeData(data.scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json({ error: "Geen actief bedrijf geselecteerd" }, { status: 400 });
  }

  if (scoped.companyId) {
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId: scoped.companyId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
    }
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId: scoped.companyId }, select: { id: true } });
      if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
    }
  } else if (data.projectId || data.customerId) {
    return NextResponse.json({ error: "Privénotities kunnen niet aan zakelijke items gekoppeld worden" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      ...scoped,
      title: data.title?.trim() || null,
      body: data.body,
      projectId: data.projectId ?? null,
      customerId: data.customerId ?? null,
      pinned: data.pinned ?? false,
    },
    include: noteInclude,
  });

  return NextResponse.json(note, { status: 201 });
}
