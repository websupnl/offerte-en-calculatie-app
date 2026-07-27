import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  customerId: z.string().min(1),
  projectId: z.string().nullish(),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  label: z.string().optional(),
  canComment: z.boolean().optional(),
  canUpload: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json([], { status: 200 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const customerId = req.nextUrl.searchParams.get("customerId");

  const access = await prisma.portalAccess.findMany({
    where: {
      companyId: session.user.activeCompanyId,
      revokedAt: null,
      projectId: projectId ?? undefined,
      customerId: customerId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, name: true } } },
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return NextResponse.json(
    access.map((item) => ({ ...item, url: `${base}/portal/${item.token}` })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 400 });
  }
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, companyId, customerId: data.customerId },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project niet gevonden bij deze klant" }, { status: 404 });
  }

  const access = await prisma.portalAccess.create({
    data: {
      companyId,
      customerId: data.customerId,
      projectId: data.projectId ?? null,
      name: data.name || customer.name,
      email: data.email || null,
      label: data.label || null,
      canComment: data.canComment ?? true,
      canUpload: data.canUpload ?? true,
    },
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return NextResponse.json({ ...access, url: `${base}/portal/${access.token}` }, { status: 201 });
}
