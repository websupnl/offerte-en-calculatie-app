import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProjectNumber } from "@/lib/format";

const schema = z.object({
  customerId: z.string().min(1, "Klant is verplicht"),
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const search = req.nextUrl.searchParams.get("search") ?? "";

  const projects = await prisma.project.findMany({
    where: {
      companyId,
      title: search ? { contains: search, mode: "insensitive" } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { quotes: true, files: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Klant moet bij dit bedrijf horen (multi-tenant veiligheid).
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  const count = await prisma.project.count({ where: { companyId } });
  const number = generateProjectNumber(company?.slug ?? "xx", count + 1);

  const project = await prisma.project.create({
    data: {
      companyId,
      customerId: parsed.data.customerId,
      number,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status ?? "OPEN",
      address: parsed.data.address,
      city: parsed.data.city,
      zipCode: parsed.data.zipCode,
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { quotes: true, files: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
