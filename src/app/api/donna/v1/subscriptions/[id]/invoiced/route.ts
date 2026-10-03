import { NextRequest } from "next/server";
import { z } from "zod";
import { donnaCompanyIds, donnaResponse } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import { markSubscriptionInvoiced, subscriptionDto } from "@/lib/subscriptions/service";
import { donnaRoute } from "../../../_shared";

const bodySchema = z
  .object({
    invoicedAt: z.string().optional(),
    periodsAdvanced: z.number().int().min(1).max(60).optional(),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return donnaRoute(req, async () => {
    const { id } = await params;
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return donnaResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid body", details: parsed.error.flatten() } },
        400,
      );
    }
    if (parsed.data.invoicedAt && Number.isNaN(new Date(parsed.data.invoicedAt).getTime())) {
      return donnaResponse({ error: { code: "invoiced_at_required", message: "invoicedAt must be a valid date" } }, 400);
    }

    const result = await markSubscriptionInvoiced(
      prisma,
      id,
      {
        invoicedAt: parsed.data.invoicedAt ? new Date(parsed.data.invoicedAt) : undefined,
        periodsAdvanced: parsed.data.periodsAdvanced,
        actor: "donna",
      },
      await donnaCompanyIds(),
    );

    return donnaResponse({
      result: result.status,
      periodsAdvanced: result.periodsAdvanced,
      subscription: subscriptionDto(result.subscription),
    });
  });
}
