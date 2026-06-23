import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  type: z.enum(["MATERIAAL", "ARBEID"]).default("MATERIAAL"),
  description: z.string().min(1),
  qty: z.coerce.number().min(0).default(1),
  unit: z.string().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().nullable().optional(),
});

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["CONCEPT", "GEPLAND", "UITGEVOERD", "GEFACTUREERD"]).optional(),
  technicianName: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional().or(z.literal("")),
  executedAt: z.string().datetime().nullable().optional().or(z.literal("")),
  lines: z.array(lineSchema).optional(),
});

/** Werkbon ophalen mits 'ie bij het actieve bedrijf hoort. */
async function getOwned(id: string, companyId: string) {
  return prisma.workOrder.findFirst({ where: { id, companyId }, select: { id: true } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      project: { select: { id: true, number: true, title: true, customer: true } },
    },
  });
  if (!workOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(workOrder);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await getOwned(id, session.user.activeCompanyId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, scheduledAt, executedAt, ...rest } = parsed.data;

  // Regels worden in z'n geheel vervangen (eenvoudig en voorspelbaar).
  await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledAt !== undefined
          ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
          : {}),
        ...(executedAt !== undefined
          ? { executedAt: executedAt ? new Date(executedAt) : null }
          : {}),
      },
    });
    if (lines) {
      await tx.workOrderLine.deleteMany({ where: { workOrderId: id } });
      if (lines.length > 0) {
        await tx.workOrderLine.createMany({
          data: lines.map((l, i) => ({
            workOrderId: id,
            type: l.type,
            description: l.description,
            qty: l.qty,
            unit: l.unit ?? "stuk",
            unitPrice: l.unitPrice,
            costPrice: l.costPrice ?? null,
            sortOrder: i,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.workOrder.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });
  return NextResponse.json({ ok: true });
}
