import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadObject, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companySlug: string; type: string }> }
) {
  const { companySlug, type } = await params;

  if (type !== "terms" && type !== "privacy") {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "S3-opslag is niet geconfigureerd" }, { status: 503 });
  }

  const key = type === "terms" ? company.termsPdfKey : company.privacyPdfKey;
  const storedName = type === "terms" ? company.termsPdfName : company.privacyPdfName;
  if (!key) {
    return NextResponse.json({ error: "Juridische PDF is nog niet geupload" }, { status: 404 });
  }

  const filename =
    storedName ??
    (type === "terms"
      ? `algemene-voorwaarden-${companySlug}.pdf`
      : `privacybeleid-${companySlug}.pdf`);

  const pdfBuffer = await downloadObject(key);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
