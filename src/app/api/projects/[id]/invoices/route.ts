import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/format";
import { computeInvoiceTotals, InvoiceLineInput } from "@/lib/invoice-totals";

const lineSchema = z.object({
  description: z.string().min(1),
  qty: z.coerce.number().min(0).default(1),
  unit: z.string().optional(),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().default(21),
});

const schema = z.object({
  reference: z.string().optional(),
  notes: z.string().optional(),
  fromQuoteId: z.string().optional(),
  fromWorkOrderId: z.string().optional(),
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

  const invoices = await prisma.salesInvoice.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  return NextResponse.json(invoices);
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
    select: { id: true, customerId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Regels bepalen: expliciet, of pre-invullen uit offerte/werkbon.
  let lines: InvoiceLineInput[] = parsed.data.lines ?? [];
  let quoteId: string | null = null;
  let workOrderId: string | null = null;

  if (parsed.data.fromQuoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: parsed.data.fromQuoteId, companyId, projectId: id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
    quoteId = quote.id;
    lines = quote.items.map((it) => ({
      description: it.description,
      qty: Number(it.qty),
      unit: "stuk",
      unitPrice: Number(it.unitPrice),
      vatRate: Number(it.vatRate),
    }));
  } else if (parsed.data.fromWorkOrderId) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: parsed.data.fromWorkOrderId, companyId, projectId: id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!wo) return NextResponse.json({ error: "Werkbon niet gevonden" }, { status: 404 });
    workOrderId = wo.id;
    lines = wo.lines.map((l) => ({
      description: l.description,
      qty: Number(l.qty),
      unit: l.unit ?? "stuk",
      unitPrice: Number(l.unitPrice),
      vatRate: 21,
    }));
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  const count = await prisma.salesInvoice.count({ where: { companyId } });
  const number = generateInvoiceNumber(company?.slug ?? "xx", count + 1);
  const totals = computeInvoiceTotals(lines);

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14); // standaard 14 dagen betaaltermijn

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      customerId: project.customerId,
      projectId: id,
      quoteId,
      workOrderId,
      number,
      reference: parsed.data.reference,
      notes: parsed.data.notes,
      invoiceDate,
      dueDate,
      ...totals,
      lines: {
        create: lines.map((l, i) => ({
          description: l.description,
          qty: l.qty,
          unit: l.unit ?? "stuk",
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          sortOrder: i,
        })),
      },
    },
    include: { _count: { select: { lines: true } } },
  });

  return NextResponse.json(invoice, { status: 201 });
}
