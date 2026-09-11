import { NextRequest } from "next/server";
import { z } from "zod";
import { donnaCompany, donnaCompanyIds, donnaResponse, parseLimit } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import {
  BILLING_CYCLES,
  DONNA_COMPANY_KEYS,
  SUBSCRIPTION_STATUSES,
  companyKeyToSlug,
  createSubscription,
  listSubscriptions,
  subscriptionDto,
} from "@/lib/subscriptions/service";
import { dateOnly } from "@/lib/subscriptions/cycle";
import { donnaRoute } from "../_shared";

export async function GET(req: NextRequest) {
  return donnaRoute(req, async () => {
    const params = req.nextUrl.searchParams;
    const companyKey = params.get("companyKey") ?? undefined;
    if (companyKey && !DONNA_COMPANY_KEYS.includes(companyKey as "websup")) {
      return donnaResponse({ error: { code: "INVALID_QUERY", message: "companyKey must be koolhaas-installaties or websup" } }, 400);
    }
    const status = params.get("status")?.toUpperCase();
    if (status && !SUBSCRIPTION_STATUSES.includes(status as "ACTIVE")) {
      return donnaResponse({ error: { code: "INVALID_QUERY", message: "Unknown subscription status" } }, 400);
    }
    const dueBeforeRaw = params.get("dueBefore");
    if (dueBeforeRaw && Number.isNaN(new Date(dueBeforeRaw).getTime())) {
      return donnaResponse({ error: { code: "INVALID_QUERY", message: "dueBefore must be YYYY-MM-DD" } }, 400);
    }

    const rows = await listSubscriptions(prisma, {
      companyIds: await donnaCompanyIds(),
      companyKey,
      clientRef: params.get("clientRef") ?? undefined,
      status: status ?? undefined,
      dueBefore: dueBeforeRaw ? dateOnly(dueBeforeRaw) : undefined,
      limit: parseLimit(params.get("limit"), 100, 500),
    });

    return donnaResponse({ subscriptions: rows.map((row) => subscriptionDto(row)) });
  });
}

const createSchema = z
  .object({
    companyKey: z.enum(DONNA_COMPANY_KEYS),
    clientRef: z.string().min(1).optional(),
    clientName: z.string().min(1).max(200).optional(),
    serviceName: z.string().min(1).max(200),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).optional(),
    vatRate: z.number().min(0).max(100).optional(),
    billingCycle: z.enum(BILLING_CYCLES),
    startDate: z.string(),
    nextBillingDate: z.string().optional(),
    notes: z.string().max(5000).optional(),
    migrationPending: z.boolean().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  return donnaRoute(req, async () => {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      const missing = parsed.error.issues.find((issue) => issue.code === "invalid_type")?.path.join(".");
      return donnaResponse(
        {
          error: {
            code: missing ? `${missing}_required` : "VALIDATION_ERROR",
            message: "Invalid subscription body",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    const data = parsed.data;
    const company = await donnaCompany(companyKeyToSlug(data.companyKey));

    let customerId: string | null = null;
    let clientName = data.clientName?.trim() ?? "";
    if (data.clientRef) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.clientRef, companyId: company.id },
        select: { id: true, name: true },
      });
      if (!customer) {
        return donnaResponse({ error: { code: "CUSTOMER_NOT_FOUND", message: "Customer was not found" } }, 404);
      }
      customerId = customer.id;
      clientName ||= customer.name;
    }
    if (!clientName) {
      return donnaResponse({ error: { code: "client_name_required", message: "clientRef or clientName is required" } }, 400);
    }
    if (Number.isNaN(new Date(data.startDate).getTime())) {
      return donnaResponse({ error: { code: "start_date_required", message: "startDate must be a valid date" } }, 400);
    }

    const created = await createSubscription(prisma, {
      companyId: company.id,
      companyKey: data.companyKey,
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
      actor: "donna",
    });

    return donnaResponse({ subscription: subscriptionDto(created) }, 201);
  });
}
