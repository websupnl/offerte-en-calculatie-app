import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { invoiceLineSchema as lineSchema } from "../lines-schema";


const schema = z.object({
  status: z.enum(["CONCEPT", "VERZONDEN", "BETAALD", "VERVALLEN"]).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  invoiceDate: z.string().optional(),
  lines: z.array(lineSchema).optional(),
});

async function getOwned(id: string, companyId: string) {
  return prisma.salesInvoice.findFirst({ where: { id, companyId }, select: { id: true } });
}

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
  if (!(await getOwned(id, session.user.activeCompanyId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, dueDate, invoiceDate, ...rest } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.salesInvoice.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {}),
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
  // Een verstuurde factuur hoort in de administratie te blijven; alleen concepten mogen weg.
  const { count } = await prisma.salesInvoice.deleteMany({
    where: { id, companyId: session.user.activeCompanyId, status: "CONCEPT" },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Alleen concepten kunnen verwijderd worden" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
