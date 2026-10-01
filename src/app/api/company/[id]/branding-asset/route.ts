import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, isStorageConfigured, uploadObject } from "@/lib/storage";
import { createQuoteAttachmentStorageRef } from "@/lib/quote-attachments";
import type { Prisma } from "@/generated/prisma";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await prisma.companyUser.findFirst({ where: { userId: session.user.id, companyId: id } });
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Bestandsopslag is niet beschikbaar" }, { status: 503 });

  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  if ((kind !== "logo" && kind !== "favicon") || !(file instanceof File)) {
    return NextResponse.json({ error: "Kies een logo of favicon" }, { status: 400 });
  }
  if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "Gebruik een PNG-, JPG- of WebP-afbeelding" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "De afbeelding mag maximaal 4 MB zijn" }, { status: 413 });

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = buildObjectKey(`${kind}.${extension}`, `branding/${id}/${kind}`);
  await uploadObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  const company = await prisma.company.findUnique({ where: { id }, select: { branding: true } });
  const current = (company?.branding ?? {}) as Record<string, unknown>;
  const field = kind === "logo" ? "logoUrl" : "faviconUrl";
  const branding = { ...current, [field]: createQuoteAttachmentStorageRef(key) };
  await prisma.company.update({ where: { id }, data: { branding: branding as Prisma.InputJsonValue } });
  await prisma.quoteShare.updateMany({ where: { quote: { companyId: id } }, data: { portalPdfUrl: null } });
  return NextResponse.json({ url: `/api/brand-assets/${id}/${kind}`, branding });
}
