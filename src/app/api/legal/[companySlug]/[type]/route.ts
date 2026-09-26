import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { downloadObject, isStorageConfigured } from "@/lib/storage";
import { LegalPDF, DEFAULT_TERMS, DEFAULT_PRIVACY } from "@/lib/pdf/legal-template";
import { pdfFilename } from "@/lib/pdf/filename";

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

  const isTerms = type === "terms";
  const key = isTerms ? company.termsPdfKey : company.privacyPdfKey;

  // Een handmatig geüploade PDF (settings → Juridisch) is altijd de bron als hij er is.
  if (key && isStorageConfigured()) {
    const storedName = isTerms ? company.termsPdfName : company.privacyPdfName;
    const filename =
      storedName ??
      (isTerms ? `algemene-voorwaarden-${companySlug}.pdf` : `privacybeleid-${companySlug}.pdf`);
    const pdfBuffer = await downloadObject(key);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  }

  // Zonder eigen upload: genereer 'm in de stijl van de offerte-PDF, met eigen
  // tekst (Company.termsContent/privacyContent) of anders de standaardtekst.
  const dbContent = (isTerms ? company.termsContent : company.privacyContent)?.trim();
  const defaults = isTerms ? DEFAULT_TERMS : DEFAULT_PRIVACY;
  const content = dbContent || defaults[companySlug] || defaults.websup;

  const element = createElement(LegalPDF, { companySlug, type, content });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer: Buffer = await renderToBuffer(element as any);
  const filename = pdfFilename(isTerms ? "Algemene-voorwaarden" : "Privacybeleid", company.name);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
