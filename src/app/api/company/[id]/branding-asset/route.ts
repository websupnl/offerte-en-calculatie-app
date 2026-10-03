import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, isStorageConfigured, uploadObject } from "@/lib/storage";
import { createQuoteAttachmentStorageRef } from "@/lib/quote-attachments";
import type { Prisma } from "@/generated/prisma";
import { brandAssetUrl } from "@/lib/branding";

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
  if (file.size === 0) return NextResponse.json({ error: "Dit bestand is leeg. Kies een andere afbeelding." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "De afbeelding mag maximaal 4 MB zijn" }, { status: 413 });

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = buildObjectKey(`${kind}.${extension}`, `branding/${id}/${kind}`);
  try {
    await uploadObject(key, Buffer.from(await file.arrayBuffer()), file.type);
    const field = kind === "logo" ? "logoUrl" : "faviconUrl";
    const value = createQuoteAttachmentStorageRef(key);
    const branding = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${id} FOR UPDATE`;
      const company = await tx.company.findUniqueOrThrow({ where: { id }, select: { branding: true } });
      const next = { ...((company.branding ?? {}) as Record<string, unknown>), [field]: value };
      await tx.company.update({ where: { id }, data: { branding: next as Prisma.InputJsonValue } });
      await tx.quote.updateMany({ where: { companyId: id }, data: { pdfUrl: null } });
      await tx.quoteShare.updateMany({ where: { quote: { companyId: id } }, data: { portalPdfUrl: null } });
      return next;
    });
    return NextResponse.json({ url: brandAssetUrl(id, kind, value), branding });
  } catch (error) {
    console.error("Branding upload failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "De afbeelding kon niet worden opgeslagen. Probeer het opnieuw." }, { status: 502 });
  }
}
