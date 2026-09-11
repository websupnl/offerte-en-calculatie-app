import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listBillingDue, subscriptionDto } from "@/lib/subscriptions/service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }

  const withinDays = req.nextUrl.searchParams.get("withinDays");
  const rows = await listBillingDue(prisma, {
    companyIds: [session.user.activeCompanyId],
    withinDays: withinDays ? Number(withinDays) : 30,
  });

  return NextResponse.json(rows.map((row) => subscriptionDto(row)));
}
