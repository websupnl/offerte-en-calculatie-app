import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, isStorageConfigured, presignDownload } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  supplierName: z.string().min(1).optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().datetime().nullable().optional().or(z.literal("")),
  amount: z.coerce.number().optional(),
  vatAmount: z.coerce.number().nullable().optional(),
  status: z.enum(["ONTVANGEN", "GEBOEKT", "BETAALD"]).optional(),
  notes: z.string().nullable().optional(),
});

/** GET geeft een verse downloadlink voor de bon-scan. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileUrl =
    invoice.fileKey && isStorageConfigured()
      ? await presignDownload(invoice.fileKey, 3600)
      : null;
  return NextResponse.json({ ...invoice, fileUrl });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await prisma.purchaseInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { invoiceDate, ...rest } = parsed.data;

  await prisma.purchaseInvoice.update({
    where: { id },
    data: {
      ...rest,
      ...(invoiceDate !== undefined
        ? { invoiceDate: invoiceDate ? new Date(invoiceDate) : null }
        : {}),
    },
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
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice.fileKey && isStorageConfigured()) {
    await deleteObject(invoice.fileKey).catch(() => {});
  }
  await prisma.purchaseInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
