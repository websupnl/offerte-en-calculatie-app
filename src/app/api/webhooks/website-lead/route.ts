import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Ontvangt nieuwe leads van de publieke websites (aparte Next.js-projecten:
// Koolhaas Installaties, WebsUp.nl) en zet ze om naar een klant + notitie in
// de bijbehorende tenant. Los van de Donna-gateway hierboven: een publieke
// website is een ander vertrouwensdomein, dus eigen secret per site.

const COMPANY_SECRETS: Record<string, string | undefined> = {
  koolhaas: process.env.KOOLHAAS_WEBSITE_LEAD_SECRET,
  websup: process.env.WEBSUP_WEBSITE_LEAD_SECRET,
};

const schema = z.object({
  company: z.enum(["koolhaas", "websup"]),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  topic: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(10_000),
  attachmentUrls: z.array(z.string().url().startsWith("https://")).max(20).optional(),
  receivedAt: z.string().datetime().optional(),
});

function verifySecret(company: string, header: string | null): boolean {
  const expected = COMPANY_SECRETS[company];
  if (!expected || !header) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (!verifySecret(input.company, req.headers.get("x-website-lead-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!input.email && !input.phone) {
    return NextResponse.json(
      { error: "email or phone is required" },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({ where: { slug: input.company } });
  if (!company) {
    return NextResponse.json({ error: `Company '${input.company}' is not configured` }, { status: 500 });
  }

  let customer = input.email
    ? await prisma.customer.findFirst({
        where: { companyId: company.id, email: { equals: input.email, mode: "insensitive" } },
      })
    : null;
  if (!customer && input.phone) {
    customer = await prisma.customer.findFirst({
      where: { companyId: company.id, phone: input.phone },
    });
  }

  let created = false;
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: input.name?.trim() || input.email || input.phone || "Nieuwe aanvraag via website",
        email: input.email,
        phone: input.phone,
        type: "KLANT",
      },
    });
    created = true;
  }

  const companyUser = await prisma.companyUser.findFirst({
    where: { companyId: company.id },
    orderBy: { id: "asc" },
  });
  if (!companyUser) {
    return NextResponse.json({ error: "Company has no user to own the note" }, { status: 409 });
  }

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  const bodyLines = [
    `Binnengekomen via de website op ${receivedAt.toLocaleString("nl-NL")}.`,
    "",
    input.message,
  ];
  if (input.attachmentUrls && input.attachmentUrls.length > 0) {
    bodyLines.push("", "Bijlagen:");
    for (const url of input.attachmentUrls) bodyLines.push(`- ${url}`);
  }

  const note = await prisma.note.create({
    data: {
      companyId: company.id,
      ownerId: companyUser.userId,
      customerId: customer.id,
      title: input.topic ? `Website-aanvraag: ${input.topic}` : "Website-aanvraag",
      body: bodyLines.join("\n"),
      visibility: "INTERNAL",
    },
  });

  return NextResponse.json(
    { customerId: customer.id, customerCreated: created, noteId: note.id },
    { status: 201 },
  );
}
