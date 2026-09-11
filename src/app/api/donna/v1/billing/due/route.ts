import { NextRequest } from "next/server";
import { donnaCompanyIds, donnaResponse } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import { DONNA_COMPANY_KEYS, listBillingDue, subscriptionDto } from "@/lib/subscriptions/service";
import { donnaRoute } from "../../_shared";

/**
 * De "te factureren"-lijst: actieve abonnementen waarvan de volgende factuurdatum
 * binnen `withinDays` dagen valt en die voor die periode nog niet gefactureerd
 * zijn. Donna polt dit periodiek om op Telegram te signaleren.
 */
export async function GET(req: NextRequest) {
  return donnaRoute(req, async () => {
    const params = req.nextUrl.searchParams;
    const withinDaysRaw = params.get("withinDays");
    const withinDays = withinDaysRaw ? Number(withinDaysRaw) : 30;
    if (!Number.isInteger(withinDays) || withinDays < 0 || withinDays > 365) {
      return donnaResponse({ error: { code: "INVALID_QUERY", message: "withinDays must be an integer from 0 through 365" } }, 400);
    }
    const companyKey = params.get("companyKey") ?? undefined;
    if (companyKey && !DONNA_COMPANY_KEYS.includes(companyKey as "websup")) {
      return donnaResponse({ error: { code: "INVALID_QUERY", message: "companyKey must be koolhaas-installaties or websup" } }, 400);
    }

    const rows = await listBillingDue(prisma, {
      companyIds: await donnaCompanyIds(),
      withinDays,
      companyKey,
    });

    return donnaResponse({
      withinDays,
      due: rows.map((row) => subscriptionDto(row)),
    });
  });
}
