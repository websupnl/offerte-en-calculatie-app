import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { INVOICE_STATUSES, isInvoiceEditable, statusTimestamps } from "@/lib/invoice-status";

const optionalText = z.string().nullable().optional();

const lineSchema = z.object({
  description: z.string().min(1),
  detail: optionalText,
  groupLabel: optionalText,
  qty: z.coerce.number().min(0).default(1),
  unit: z.string().optional(),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().default(21),
});

/** "2026-09-18" of een volledige ISO-datum; leeg = wissen. */
const dateField = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.literal(""), z.null()])
  .optional();

const schema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  reference: optionalText,
  notes: optionalText,
  subject: optionalText,
  intro: optionalText,
  invoiceDate: dateField,
  dueDate: dateField,
  periodStart: dateField,
  periodEnd: dateField,
  lines: z.array(lineSchema).optional(),
});

/** Velden die op het document staan en na versturen vastliggen. */
const DOCUMENT_FIELDS = [
  "reference",
  "notes",
  "subject",
  "intro",
  "invoiceDate",
  "dueDate",
  "periodStart",
  "periodEnd",
  "lines",
] as const;

const toDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? new Date(v.length === 10 ? `${v}T00:00:00.000Z` : v) : null;

const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() ? v.trim() : null);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: true,
      project: { select: { id: true, number: true, title: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const current = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true, status: true, sentAt: true, paidAt: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, status, invoiceDate, dueDate, periodStart, periodEnd, ...text } = parsed.data;

  // Een verstuurde factuur ligt vast. Wie iets wil corrigeren zet hem eerst
  // terug naar concept (of maakt straks een creditfactuur).
  const editsDocument = DOCUMENT_FIELDS.some((f) => parsed.data[f] !== undefined);
  const willBeEditable = isInvoiceEditable(status ?? current.status);
  if (editsDocument && !(isInvoiceEditable(current.status) && willBeEditable)) {
    return NextResponse.json(
      { error: "Deze factuur is verstuurd en ligt vast. Zet hem terug naar concept om hem aan te passen." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesInvoice.update({
      where: { id },
      data: {
        reference: emptyToNull(text.reference),
        notes: emptyToNull(text.notes),
        subject: emptyToNull(text.subject),
        intro: emptyToNull(text.intro),
        invoiceDate: toDate(invoiceDate) ?? undefined,
        dueDate: toDate(dueDate),
        periodStart: toDate(periodStart),
        periodEnd: toDate(periodEnd),
        ...(status ? { status, ...statusTimestamps(current.status, status, current) } : {}),
        // Totalen herberekenen wanneer regels meekomen.
        ...(lines ? computeInvoiceTotals(lines) : {}),
      },
    });
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      if (lines.length > 0) {
        await tx.invoiceLine.createMany({
          data: lines.map((l, i) => ({
            invoiceId: id,
            description: l.description,
            detail: emptyToNull(l.detail) ?? null,
            groupLabel: emptyToNull(l.groupLabel) ?? null,
            qty: l.qty,
            unit: l.unit ?? "stuk",
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            sortOrder: i,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { status: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Een verstuurde factuur weggooien geeft een gat in de reeks. Crediteren, niet verwijderen.
  if (!isInvoiceEditable(invoice.status)) {
    return NextResponse.json({ error: "Alleen een concept kan verwijderd worden." }, { status: 409 });
  }
  await prisma.salesInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
