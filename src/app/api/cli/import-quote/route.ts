import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateQuoteImportInput } from "@/lib/quote-import";
import { generateQuoteNumber } from "@/lib/format";
import { z } from "zod";

function authorized(req: NextRequest) {
  const key = req.headers.get("x-cli-key");
  return key && key === process.env.CLI_API_KEY;
}

const customerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { companySlug, customer: customerInput, quote: rawQuote } = body;

  if (!companySlug || !rawQuote) {
    return NextResponse.json(
      { error: "companySlug en quote zijn verplicht" },
      { status: 400 }
    );
  }

  // Valideer en normaliseer de offerte JSON (zelfde flow als paste-import in de UI)
  const validated = validateQuoteImportInput(rawQuote);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "Ongeldige offerte JSON", details: validated.errors },
      { status: 422 }
    );
  }

  const { data, warnings } = validated;

  // Zoek het bedrijf
  const company = await prisma.company.findFirst({ where: { slug: companySlug } });
  if (!company) {
    return NextResponse.json({ error: `Bedrijf '${companySlug}' niet gevonden` }, { status: 404 });
  }

  // Vind of maak de eerste admin-user van dit bedrijf (voor createdById)
  const companyUser = await prisma.companyUser.findFirst({
    where: { companyId: company.id },
    include: { user: true },
    orderBy: { user: { createdAt: "asc" } },
  });
  if (!companyUser) {
    return NextResponse.json({ error: "Geen gebruiker gevonden voor dit bedrijf" }, { status: 404 });
  }

  // Zoek bestaande klant of maak aan
  const parsedCustomer = customerSchema.safeParse(customerInput ?? {});
  const cInput = parsedCustomer.success ? parsedCustomer.data : {};

  let customer = cInput.email
    ? await prisma.customer.findFirst({ where: { companyId: company.id, email: cInput.email } })
    : null;

  if (!customer && cInput.name) {
    customer = await prisma.customer.findFirst({
      where: { companyId: company.id, name: { contains: cInput.name, mode: "insensitive" } },
    });
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: cInput.name ?? "Onbekend",
        email: cInput.email ?? null,
        address: cInput.address ?? null,
        city: cInput.city ?? null,
        zipCode: cInput.zipCode ?? null,
        phone: cInput.phone ?? null,
      },
    });
  }

  // Offertenummer genereren
  const count = await prisma.quote.count({ where: { companyId: company.id } });
  const number = generateQuoteNumber(company.slug, count + 1);

  // validUntil berekenen
  const validDays = data.validDays ?? 30;
  const validUntil = new Date(Date.now() + validDays * 86_400_000);

  // Totalen berekenen op basis van vaste items (keuze-items tellen mee na klantselactie)
  let totalExVat = 0;
  let totalVat = 0;
  const itemsWithOrder = data.items.map((item, i) => {
    const total = item.qty * item.unitPrice;
    totalExVat += total;
    totalVat += total * (item.vatRate / 100);
    return { ...item, total, sortOrder: i };
  });

  const quote = await prisma.quote.create({
    data: {
      companyId: company.id,
      customerId: customer.id,
      createdById: companyUser.userId,
      number,
      title: data.title ?? null,
      category: data.category ?? null,
      tagline: data.tagline ?? null,
      itemsHeader: data.itemsHeader ?? null,
      quoteType: data.quoteType ?? "GENERAL",
      validUntil,
      intro: data.intro ?? null,
      outro: data.outro ?? null,
      notes: data.notes ?? null,
      internalAdvice: data.internalAdvice ?? null,
      flow: data.flow ?? [],
      approach: data.approach ?? [],
      exclusions: data.exclusions ?? [],
      assumptions: data.assumptions ?? [],
      technicalNotes: data.technicalNotes ?? [],
      customerResponsibilities: data.customerResponsibilities ?? [],
      planning: data.planning ?? {},
      commercial: data.commercial ?? {},
      batteryAdvice: data.batteryAdvice ?? {},
      // optionalWork → options JSON
      options: data.optionalWork ?? [],
      // configurations → choiceGroups JSON
      choiceGroups: data.configurations ?? [],
      totalExVat,
      totalVat,
      totalIncVat: totalExVat + totalVat,
      items: { create: itemsWithOrder },
    },
    include: { customer: true, items: true },
  });

  return NextResponse.json(
    { ...quote, warnings },
    { status: 201 }
  );
}
