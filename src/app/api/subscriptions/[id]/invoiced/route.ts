import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SubscriptionError,
  markSubscriptionInvoiced,
  subscriptionDto,
} from "@/lib/subscriptions/service";

const bodySchema = z
  .object({
    invoicedAt: z.string().datetime().optional(),
    periodsAdvanced: z.number().int().min(1).max(60).optional(),
  })
  .optional()
  .default({});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await markSubscriptionInvoiced(
      prisma,
      id,
      {
        invoicedAt: parsed.data.invoicedAt ? new Date(parsed.data.invoicedAt) : undefined,
        periodsAdvanced: parsed.data.periodsAdvanced,
        actor: session.user.name ?? "onbekend",
      },
      [session.user.activeCompanyId],
    );
    return NextResponse.json({
      status: result.status,
      periodsAdvanced: result.periodsAdvanced,
      subscription: subscriptionDto(result.subscription),
    });
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
