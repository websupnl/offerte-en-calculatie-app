import { NextRequest } from "next/server";
import { donnaCompanyIds, donnaResponse } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import { listAgreementGaps } from "@/lib/subscriptions/service";
import { donnaRoute } from "../../_shared";

/**
 * Geaccepteerde offertes zonder rij in AgreementLog. Voor Donna's signaal
 * "N projecten zonder formeel akkoord". Bedragen in hele centen.
 */
export async function GET(req: NextRequest) {
  return donnaRoute(req, async () => {
    const gaps = await listAgreementGaps(prisma, await donnaCompanyIds());
    return donnaResponse({ gaps });
  });
}
