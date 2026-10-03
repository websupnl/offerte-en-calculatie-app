import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  createSubscription,
  listSubscriptions,
  slugToCompanyKey,
  subscriptionDto,
} from "@/lib/subscriptions/service";
import { dateOnly } from "@/lib/subscriptions/cycle";

async function activeCompany() {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return null;
  const company = await prisma.company.findUnique({
    where: { id: session.user.activeCompanyId },
    select: { id: true, slug: true },
  });
  return company ? { ...company, userName: session.user.name ?? "onbekend" } : null;
}

export async function GET(req: NextRequest) {
  const company = await activeCompany();
  if (!company) return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const status = params.get("status")?.toUpperCase();
  if (status && !SUBSCRIPTION_STATUSES.includes(status as "ACTIVE")) {
    return NextResponse.json({ error: "Onbekende status" }, { status: 400 });
  }

  const rows = await listSubscriptions(prisma, {
    companyIds: [company.id],
    clientRef: params.get("clientRef") ?? undefined,
    status: status ?? undefined,
    dueBefore: params.get("dueBefore") ? dateOnly(params.get("dueBefore")!) : undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  });

  return NextResponse.json(rows.map((row) => subscriptionDto(row)));
}

const createSchema = z.object({
  customerId: z.string().min(1).nullish(),
  clientName: z.string().trim().min(1).max(200).optional(),
  serviceName: z.string().trim().min(1).max(200),
  priceCents: z.number().int().min(0),
  vatRate: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  billingCycle: z.enum(BILLING_CYCLES),
  startDate: z.string(),
  nextBillingDate: z.string().optional(),
  notes: z.string().max(5000).nullish(),
  migrationPending: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const company = await activeCompany();
  if (!company) return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let clientName = data.clientName?.trim() ?? "";
  let customerId: string | null = null;
  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId: company.id },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Klant bestaat niet binnen dit bedrijf" }, { status: 400 });
    }
    customerId = customer.id;
    clientName ||= customer.name;
  }
  if (!clientName) {
    return NextResponse.json({ error: "clientName of een geldige customerId is verplicht" }, { status: 400 });
  }

  const created = await createSubscription(prisma, {
    companyId: company.id,
    companyKey: slugToCompanyKey(company.slug),
    customerId,
    clientName,
    serviceName: data.serviceName,
    priceCents: data.priceCents,
    vatRate: data.vatRate,
    currency: data.currency,
    billingCycle: data.billingCycle,
    startDate: dateOnly(data.startDate),
    nextBillingDate: data.nextBillingDate ? dateOnly(data.nextBillingDate) : undefined,
    notes: data.notes ?? null,
    migrationPending: data.migrationPending,
    actor: company.userName,
  });

  return NextResponse.json(subscriptionDto(created), { status: 201 });
}
