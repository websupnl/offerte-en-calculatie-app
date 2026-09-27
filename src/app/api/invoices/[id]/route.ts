import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { invoiceLineSchema as lineSchema } from "../lines-schema";
import { invoiceAmountMatches, invoiceMollieKey, mollieInvoiceRequest } from "@/lib/mollie-invoices";


const schema = z.object({
  status: z.enum(["CONCEPT", "VERZONDEN", "BETAALD", "VERVALLEN"]).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  invoiceDate: z.string().optional(),
  lines: z.array(lineSchema).optional(),
});

async function getOwned(id: string, companyId: string) {
  return prisma.salesInvoice.findFirst({
    where: { id, companyId },
    select: {
      id: true, status: true, totalIncVat: true, molliePaymentLinkId: true, molliePaymentMode: true,
      company: { select: { slug: true } },
    },
  });
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
  const owned = await getOwned(id, session.user.activeCompanyId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (owned.status !== "CONCEPT") {
    const onlyStatus = Object.keys(parsed.data).length === 1 && parsed.data.status;
    const validTransition = (owned.status === "VERZONDEN" || owned.status === "VERVALLEN")
      && (parsed.data.status === "BETAALD" || parsed.data.status === "VERVALLEN");
    if (!onlyStatus || !validTransition) {
      return NextResponse.json({ error: "Een definitieve factuur kan niet worden aangepast" }, { status: 409 });
    }
  } else if (parsed.data.status && !["CONCEPT", "VERZONDEN"].includes(parsed.data.status)) {
    return NextResponse.json({ error: "Maak de factuur eerst definitief" }, { status: 409 });
  }
  let molliePaidAt: Date | null = null;
  if (parsed.data.status === "BETAALD" && owned.molliePaymentLinkId) {
    const key = invoiceMollieKey(owned.company.slug);
    if (!key) return NextResponse.json({ error: "Mollie-key ontbreekt: betaalstatus niet gewijzigd" }, { status: 503 });
    try {
      const link = await mollieInvoiceRequest(key, `payment-links/${owned.molliePaymentLinkId}`);
      if (!invoiceAmountMatches(link, owned.totalIncVat, owned.molliePaymentMode ?? "")) {
        return NextResponse.json({ error: "Betaallink komt niet overeen met de factuur" }, { status: 409 });
      }
      if (link.paidAt) {
        molliePaidAt = new Date(link.paidAt);
      } else {
        // Handmatig ontvangen bankbetaling: voorkom dat de link daarna nog wordt gebruikt.
        await mollieInvoiceRequest(key, `payment-links/${link.id}`, { method: "PATCH", body: { archived: true } });
      }
    } catch (error) {
      console.error("Mollie-betaallink sluiten mislukt:", error);
      return NextResponse.json({ error: "Mollie-betaallink kon niet worden afgesloten" }, { status: 502 });
    }
  }
  const { lines, dueDate, invoiceDate, ...rest } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.salesInvoice.update({
      where: { id },
      data: {
        ...rest,
        ...(molliePaidAt ? { molliePaidAt } : {}),
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
