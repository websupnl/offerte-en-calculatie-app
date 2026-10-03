import { NextRequest } from "next/server";
import { z } from "zod";
import { donnaCompanyIds, donnaResponse } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import {
  SUBSCRIPTION_STATUSES,
  SubscriptionError,
  patchSubscription,
  subscriptionDto,
} from "@/lib/subscriptions/service";
import { dateOnly } from "@/lib/subscriptions/cycle";
import { donnaRoute } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return donnaRoute(req, async () => {
    const { id } = await params;
    const row = await prisma.subscription.findFirst({
      where: { id, companyId: { in: await donnaCompanyIds() } },
      include: { events: { orderBy: { occurredAt: "desc" }, take: 50 } },
    });
    if (!row) {
      return donnaResponse({ error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription was not found" } }, 404);
    }
    return donnaResponse({ subscription: subscriptionDto(row) });
  });
}

const patchSchema = z
  .object({
    priceCents: z.number().int().min(0).optional(),
    nextBillingDate: z.string().optional(),
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    serviceName: z.string().min(1).max(200).optional(),
    notes: z.string().max(5000).nullable().optional(),
    migrationPending: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return donnaRoute(req, async () => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return donnaResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid patch body", details: parsed.error.flatten() } },
        400,
      );
    }
    if (parsed.data.nextBillingDate && Number.isNaN(new Date(parsed.data.nextBillingDate).getTime())) {
      return donnaResponse({ error: { code: "next_billing_date_required", message: "nextBillingDate must be a valid date" } }, 400);
    }

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
          actor: "donna",
        },
        await donnaCompanyIds(),
      );
      return donnaResponse({ subscription: subscriptionDto(updated) });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return donnaResponse({ error: { code: error.code, message: error.message } }, error.status);
      }
      throw error;
    }
  });
}
