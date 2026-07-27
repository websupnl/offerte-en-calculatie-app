import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  kind: z.enum(["LIVE", "IMAGE"]).default("LIVE"),
  url: z.string().url().optional().or(z.literal("")),
  imageKey: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json([], { status: 200 });

  const { id } = await params;
  const boards = await prisma.reviewBoard.findMany({
    where: { projectId: id, companyId: session.user.activeCompanyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pins: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json(boards);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = session.user.activeCompanyId;

  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.kind === "LIVE" && !data.url) {
    return NextResponse.json({ error: "Vul de URL van de pagina in" }, { status: 400 });
  }
  if (data.kind === "IMAGE" && !data.imageKey) {
    return NextResponse.json({ error: "Upload eerst een schermafbeelding" }, { status: 400 });
  }

  const board = await prisma.reviewBoard.create({
    data: {
      companyId,
      projectId: id,
      name: data.name,
      kind: data.kind,
      url: data.url || null,
      imageKey: data.imageKey || null,
      imageWidth: data.imageWidth ?? null,
      imageHeight: data.imageHeight ?? null,
    },
    include: { _count: { select: { pins: true } } },
  });

  return NextResponse.json(board, { status: 201 });
}
