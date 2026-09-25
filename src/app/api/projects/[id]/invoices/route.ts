import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvoiceSettings } from "@/lib/branding";
import { linesFromSource, nextInvoiceNumber } from "@/lib/invoice-sources";
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

  // Regels bepalen: expliciet, of pre-invullen uit offerte/werkbon (zelfde logica als /api/invoices).
  let lines: InvoiceLineInput[] = parsed.data.lines ?? [];
  let quoteId: string | null = null;
  let workOrderId: string | null = null;
  let reference = parsed.data.reference ?? null;

  const source = parsed.data.fromQuoteId
    ? ({ type: "quote", id: parsed.data.fromQuoteId } as const)
    : parsed.data.fromWorkOrderId
      ? ({ type: "workorder", id: parsed.data.fromWorkOrderId } as const)
      : null;
  if (source) {
    const result = await linesFromSource(source, companyId);
    if (!result || result.projectId !== id) {
      return NextResponse.json({ error: source.type === "quote" ? "Offerte niet gevonden" : "Werkbon niet gevonden" }, { status: 404 });
    }
    lines = result.lines;
    quoteId = result.quoteId;
    workOrderId = result.workOrderId;
    reference = reference ?? result.reference;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true, settings: true },
  });
  const number = await nextInvoiceNumber(companyId, company?.slug ?? "xx");
  const totals = computeInvoiceTotals(lines);

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (getInvoiceSettings(company?.settings).paymentDays || 14));

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      customerId: project.customerId,
      projectId: id,
      quoteId,
      workOrderId,
      number,
      reference,
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
