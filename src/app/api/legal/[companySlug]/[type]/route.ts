import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { LegalPDF, DEFAULT_TERMS, DEFAULT_PRIVACY, LegalDocumentType } from "@/lib/pdf/legal-template";
import { createElement } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPANY_META: Record<string, { email: string; website: string; address?: string }> = {
  websup: { email: "hallo@websup.nl", website: "websup.nl", address: "Friesland, Nederland" },
  koolhaas: { email: "daan@koolhaasinstallaties.nl", website: "koolhaasinstallaties.nl", address: "Friesland, Nederland" },
};

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

  const docType = type as LegalDocumentType;
  const content =
    docType === "terms"
      ? (company.termsContent ?? DEFAULT_TERMS[companySlug] ?? DEFAULT_TERMS.websup)
      : (company.privacyContent ?? DEFAULT_PRIVACY[companySlug] ?? DEFAULT_PRIVACY.websup);

  const meta = COMPANY_META[companySlug] ?? COMPANY_META.websup;

  const element = createElement(LegalPDF, {
    companySlug,
    companyName: company.name,
    companyEmail: meta.email,
    companyWebsite: meta.website,
    companyAddress: meta.address,
    type: docType,
    content,
    version: "1.0",
    date: new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer: Buffer = await renderToBuffer(element as any);

  const filename =
    docType === "terms"
      ? `algemene-voorwaarden-${companySlug}.pdf`
      : `privacybeleid-${companySlug}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
