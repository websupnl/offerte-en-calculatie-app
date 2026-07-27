import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContractNumber } from "@/lib/format";

const schema = z.object({
  customerId: z.string().min(1, "Klant is verplicht"),
  title: z.string().min(1, "Titel is verplicht"),
  body: z.string().optional(),
  projectId: z.string().nullish(),
  quoteId: z.string().nullish(),
  startDate: z.string().datetime().nullish(),
  endDate: z.string().datetime().nullish(),
  noticePeriodDays: z.number().int().min(0).max(365).nullish(),
  autoRenew: z.boolean().optional(),
  recurringAmount: z.number().nullish(),
  recurringPeriod: z.enum(["MONTH", "QUARTER", "YEAR"]).nullish(),
});

const contractInclude = {
  customer: { select: { id: true, name: true } },
  project: { select: { id: true, number: true, title: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json([], { status: 200 });

  const status = req.nextUrl.searchParams.get("status");

  const contracts = await prisma.contract.findMany({
    where: {
      companyId: session.user.activeCompanyId,
      deletedAt: null,
      status: status ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    include: contractInclude,
    take: 300,
  });

  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 400 });
  }
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  if (data.projectId) {
    const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  const count = await prisma.contract.count({ where: { companyId } });

  // Verlenging: op tijd een seintje, rekening houdend met de opzegtermijn.
  const endDate = data.endDate ? new Date(data.endDate) : null;
  const renewalNoticeAt =
    endDate && data.noticePeriodDays
      ? new Date(endDate.getTime() - data.noticePeriodDays * 86400000)
      : null;

  const contract = await prisma.contract.create({
    data: {
      companyId,
      customerId: data.customerId,
      projectId: data.projectId ?? null,
      quoteId: data.quoteId ?? null,
      number: generateContractNumber(company?.slug ?? "wu", count + 1),
      title: data.title,
      body: data.body,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate,
      noticePeriodDays: data.noticePeriodDays ?? null,
      autoRenew: data.autoRenew ?? false,
      renewalNoticeAt,
      recurringAmount: data.recurringAmount ?? null,
      recurringPeriod: data.recurringPeriod ?? null,
      events: { create: { type: "CREATED", actor: session.user.name ?? session.user.email ?? null } },
    },
    include: contractInclude,
  });

  // Herinnering als taak — anders vergeet ik 'm toch.
  if (renewalNoticeAt && session.user.id) {
    await prisma.task.create({
      data: {
        companyId,
        ownerId: session.user.id,
        customerId: data.customerId,
        projectId: data.projectId ?? null,
        title: `Contract ${contract.number} verloopt — opzeggen of verlengen?`,
        description: `${contract.title}\nEinddatum: ${endDate!.toLocaleDateString("nl-NL")}\nOpzegtermijn: ${data.noticePeriodDays} dagen`,
        dueAt: renewalNoticeAt,
        allDay: true,
        priority: 1,
        source: "MANUAL",
      },
    });
  }

  return NextResponse.json(contract, { status: 201 });
}
