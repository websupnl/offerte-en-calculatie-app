import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  status: z.enum(["CONCEPT", "VERZONDEN", "GETEKEND", "ACTIEF", "OPGEZEGD", "VERLOPEN"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  noticePeriodDays: z.number().int().min(0).max(365).nullable().optional(),
  autoRenew: z.boolean().optional(),
  recurringAmount: z.number().nullable().optional(),
  recurringPeriod: z.enum(["MONTH", "QUARTER", "YEAR"]).nullable().optional(),
  projectId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: session.user.activeCompanyId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, number: true, title: true } },
      events: { orderBy: { createdAt: "desc" } },
      attachments: true,
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract niet gevonden" }, { status: 404 });

  return NextResponse.json(contract);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.contract.findFirst({
    where: { id, companyId: session.user.activeCompanyId, deletedAt: null },
    select: { id: true, status: true, endDate: true, noticePeriodDays: true },
  });
  if (!existing) return NextResponse.json({ error: "Contract niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const endDate = data.endDate === undefined ? existing.endDate : data.endDate ? new Date(data.endDate) : null;
  const noticeDays = data.noticePeriodDays === undefined ? existing.noticePeriodDays : data.noticePeriodDays;
  const renewalNoticeAt = endDate && noticeDays ? new Date(endDate.getTime() - noticeDays * 86400000) : null;

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      title: data.title,
      body: data.body,
      status: data.status,
      startDate: data.startDate === undefined ? undefined : data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate === undefined ? undefined : endDate,
      noticePeriodDays: data.noticePeriodDays,
      autoRenew: data.autoRenew,
      recurringAmount: data.recurringAmount,
      recurringPeriod: data.recurringPeriod,
      projectId: data.projectId,
      renewalNoticeAt,
      ...(data.status && data.status !== existing.status
        ? {
            events: {
              create: {
                type: data.status === "OPGEZEGD" ? "TERMINATED" : "NOTE",
                detail: `Status: ${existing.status} → ${data.status}`,
                actor: session.user.name ?? session.user.email ?? null,
              },
            },
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      project: { select: { id: true, number: true, title: true } },
    },
  });

  return NextResponse.json(contract);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.contract.findFirst({
    where: { id, companyId: session.user.activeCompanyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Contract niet gevonden" }, { status: 404 });

  // Een getekend contract weggooien mag niet: dat is een ondertekend document,
  // geen kladje. Opzeggen kan wel via de status.
  if (existing.status === "GETEKEND" || existing.status === "ACTIEF") {
    return NextResponse.json(
      { error: "Een getekend of actief contract kun je niet verwijderen. Zet 'm op Opgezegd." },
      { status: 409 },
    );
  }

  await prisma.contract.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
