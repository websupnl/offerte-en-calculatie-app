import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { getInvoiceSettings } from "@/lib/branding";
import { linesFromSource, nextInvoiceNumber } from "@/lib/invoice-sources";
import { invoiceLineSchema, invoiceSourceSchema } from "./lines-schema";

const schema = z.object({
  customerId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  source: invoiceSourceSchema.optional(),
  lines: z.array(invoiceLineSchema).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Nieuwe factuur. Regels komen uit een bron (offerte, calculatie, werkbon) of
 * worden meegestuurd (artikelen en vrije regels). Meegestuurde regels winnen:
 * zo kan de nieuwe-factuurpagina de bronregels eerst laten bewerken.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const fromSource = data.source ? await linesFromSource(data.source, companyId, { detailed: data.source.detailed }) : null;
  if (data.source && !fromSource) return NextResponse.json({ error: "Bron niet gevonden" }, { status: 404 });

  const customerId = data.customerId ?? fromSource?.customerId;
  if (!customerId) return NextResponse.json({ error: "Kies een klant" }, { status: 400 });
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const projectId = data.projectId !== undefined ? data.projectId : fromSource?.projectId ?? null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }

  const lines = data.lines ?? fromSource?.lines ?? [];
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true, settings: true } });
  const invoiceSettings = getInvoiceSettings(company?.settings);

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (invoiceSettings.paymentDays || 14));

  // Twee gelijktijdige aanmaken kunnen hetzelfde nummer pakken; dan één keer opnieuw.
  for (let poging = 0; poging < 3; poging++) {
    const number = await nextInvoiceNumber(companyId, company?.slug ?? "xx", invoiceDate);
    const bestaat = await prisma.salesInvoice.findFirst({ where: { companyId, number }, select: { id: true } });
    if (bestaat) continue;
    const invoice = await prisma.salesInvoice.create({
      data: {
        companyId,
        customerId,
        projectId,
        quoteId: fromSource?.quoteId ?? null,
        workOrderId: fromSource?.workOrderId ?? null,
        number,
        reference: data.reference ?? fromSource?.reference ?? null,
        notes: data.notes,
        invoiceDate,
        dueDate,
        ...computeInvoiceTotals(lines),
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
      select: { id: true, number: true },
    });
    return NextResponse.json(invoice, { status: 201 });
  }
  return NextResponse.json({ error: "Kon geen uniek factuurnummer bepalen" }, { status: 409 });
}
