import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SUBSCRIPTION_STATUSES,
  SubscriptionError,
  patchSubscription,
  subscriptionDto,
} from "@/lib/subscriptions/service";
import { dateOnly } from "@/lib/subscriptions/cycle";

async function companyContext() {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return null;
  return { companyId: session.user.activeCompanyId, userName: session.user.name ?? "onbekend" };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await companyContext();
  if (!ctx) return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  const { id } = await params;

  const row = await prisma.subscription.findFirst({
    where: { id, companyId: ctx.companyId },
    include: {
      events: { orderBy: { occurredAt: "desc" } },
      quote: { select: { id: true, number: true, title: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const agreementLogs = row.sourceQuoteId
    ? await prisma.agreementLog.findMany({
        where: { quoteId: row.sourceQuoteId },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true, method: true, avVersion: true, ip: true },
      })
    : [];

  return NextResponse.json({
    ...subscriptionDto(row),
    quote: row.quote,
    customer: row.customer,
    agreementLogs,
  });
}

const patchSchema = z.object({
  priceCents: z.number().int().min(0).optional(),
  nextBillingDate: z.string().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  serviceName: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(5000).nullish(),
  migrationPending: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await companyContext();
  if (!ctx) return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await patchSubscription(
      prisma,
      id,
      {
        priceCents: parsed.data.priceCents,
        nextBillingDate: parsed.data.nextBillingDate ? dateOnly(parsed.data.nextBillingDate) : undefined,
        status: parsed.data.status,
        serviceName: parsed.data.serviceName,
        notes: parsed.data.notes ?? undefined,
        migrationPending: parsed.data.migrationPending,
        actor: ctx.userName,
      },
      [ctx.companyId],
    );
    return NextResponse.json(subscriptionDto(updated));
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
