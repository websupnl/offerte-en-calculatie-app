import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_TASK_STATUSES, TASK_LIST_KINDS, parseScope, scopeData, scopeWhere } from "@/lib/tasks";

const schema = z.object({
  scope: z.enum(["business", "private"]).default("business"),
  name: z.string().min(1, "Naam is verplicht"),
  kind: z.enum(TASK_LIST_KINDS).default("LIST"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = parseScope(req.nextUrl.searchParams.get("scope"));
  let where;
  try {
    where = scopeWhere(scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json([], { status: 200 });
  }

  const lists = await prisma.taskList.findMany({
    where: { ...where, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: { where: { deletedAt: null, status: { in: [...ACTIVE_TASK_STATUSES] } } } } },
    },
  });

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let scoped;
  try {
    scoped = scopeData(parsed.data.scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json({ error: "Geen actief bedrijf geselecteerd" }, { status: 400 });
  }

  const count = await prisma.taskList.count({ where: scoped.companyId ? { companyId: scoped.companyId } : { companyId: null, ownerId: scoped.ownerId } });

  const list = await prisma.taskList.create({
    data: {
      ...scoped,
      name: parsed.data.name,
      kind: parsed.data.kind,
      icon: parsed.data.icon,
      color: parsed.data.color,
      sortOrder: count,
    },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json(list, { status: 201 });
}
