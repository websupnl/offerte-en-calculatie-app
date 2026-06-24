import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, isStorageConfigured, uploadObject } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoices = await prisma.purchaseInvoice.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const supplierName = String(form.get("supplierName") ?? "").trim();
  if (!supplierName) {
    return NextResponse.json({ error: "Leverancier is verplicht" }, { status: 400 });
  }
  const invoiceNumber = form.get("invoiceNumber")?.toString() || null;
  const invoiceDateRaw = form.get("invoiceDate")?.toString();
  const amount = Number(form.get("amount") ?? 0);
  const vatRaw = form.get("vatAmount")?.toString();
  const notes = form.get("notes")?.toString() || null;
  const file = form.get("file");

  // Optionele bon-scan/foto naar MinIO.
  let fileKey: string | null = null;
  let fileName: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Bestand te groot (max 25MB)" }, { status: 400 });
    }
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: "Storage niet geconfigureerd" }, { status: 503 });
    }
    fileKey = buildObjectKey(file.name, `inkoop/${id}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadObject(fileKey, bytes, file.type || "application/octet-stream");
    fileName = file.name;
  }

  const invoice = await prisma.purchaseInvoice.create({
    data: {
      companyId,
      projectId: id,
      supplierName,
      invoiceNumber,
      invoiceDate: invoiceDateRaw ? new Date(invoiceDateRaw) : null,
      amount: isNaN(amount) ? 0 : amount,
      vatAmount: vatRaw && !isNaN(Number(vatRaw)) ? Number(vatRaw) : null,
      notes,
      fileKey,
      fileName,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
