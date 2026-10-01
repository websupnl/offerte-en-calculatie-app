import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQuoteAttachmentStorageKey } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ companyId: string; asset: string }> }) {
  const { companyId, asset } = await params;
  if (asset !== "logo" && asset !== "favicon") return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { branding: true } });
  if (!company) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const branding = (company.branding ?? {}) as Record<string, unknown>;
  const value = branding[asset === "logo" ? "logoUrl" : "faviconUrl"];
  if (typeof value !== "string") return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (!value.startsWith("s3://")) {
    if (!value.startsWith("/logos/") && !value.startsWith("/icons/")) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    return NextResponse.redirect(new URL(value, _req.url));
  }
  const key = getQuoteAttachmentStorageKey(value);
  if (!key || !key.startsWith(`branding/${companyId}/`) || !isStorageConfigured()) {
    return NextResponse.json({ error: "Afbeelding niet beschikbaar" }, { status: 404 });
  }
  return NextResponse.redirect(await presignDownload(key, 3600), { headers: { "Cache-Control": "public, max-age=300" } });
}
