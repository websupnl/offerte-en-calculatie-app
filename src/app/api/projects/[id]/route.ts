import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  customerId: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true, totalIncVat: true, createdAt: true },
      },
      files: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Als klant wijzigt: moet bij dit bedrijf horen.
  if (parsed.data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, companyId: session.user.activeCompanyId },
      select: { id: true },
    });
    if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }

  const result = await prisma.project.updateMany({
    where: { id, companyId: session.user.activeCompanyId },
    data: parsed.data,
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Bestanden in MinIO blijven staan (orphan); cascade ruimt alleen DB-rijen.
  // Bewust: liever een orphan dan per ongeluk data weggooien.
  await prisma.project.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });

  return NextResponse.json({ ok: true });
}
