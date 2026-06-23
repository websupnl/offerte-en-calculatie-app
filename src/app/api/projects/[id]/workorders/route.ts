import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWorkOrderNumber } from "@/lib/format";

const lineSchema = z.object({
  type: z.enum(["MATERIAAL", "ARBEID"]).default("MATERIAAL"),
  description: z.string().min(1),
  qty: z.coerce.number().min(0).default(1),
  unit: z.string().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().nullable().optional(),
});

const schema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional(),
  scheduledAt: z.string().datetime().optional().or(z.literal("")),
  technicianName: z.string().optional(),
  fromQuoteId: z.string().optional(), // materiaal pre-invullen vanuit offerte
  lines: z.array(lineSchema).optional(),
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
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workOrders = await prisma.workOrder.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  return NextResponse.json(workOrders);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  const count = await prisma.workOrder.count({ where: { companyId } });
  const number = generateWorkOrderNumber(company?.slug ?? "xx", count + 1);

  // Optioneel: materiaal overnemen uit een offerte van ditzelfde project.
  let prefilled = parsed.data.lines ?? [];
  if (parsed.data.fromQuoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: parsed.data.fromQuoteId, companyId, projectId: id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (quote) {
      prefilled = quote.items.map((it) => ({
        type: "MATERIAAL" as const,
        description: it.description,
        qty: Number(it.qty),
        unit: "stuk",
        unitPrice: Number(it.unitPrice),
        costPrice: it.costPrice != null ? Number(it.costPrice) : null,
      }));
    }
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      companyId,
      projectId: id,
      number,
      title: parsed.data.title,
      description: parsed.data.description,
      technicianName: parsed.data.technicianName,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      status: parsed.data.scheduledAt ? "GEPLAND" : "CONCEPT",
      lines: {
        create: prefilled.map((l, i) => ({
          type: l.type,
          description: l.description,
          qty: l.qty,
          unit: l.unit ?? "stuk",
          unitPrice: l.unitPrice,
          costPrice: l.costPrice ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { lines: true, _count: { select: { lines: true } } },
  });

  return NextResponse.json(workOrder, { status: 201 });
}
