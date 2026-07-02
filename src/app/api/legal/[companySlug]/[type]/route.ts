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

// Verwijdert tekens waar de PDF-renderer op stukloopt: control chars, losse
// surrogates en exotische line/paragraph separators uit geplakte content.
function sanitizeContent(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

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
  const defaultContent =
    docType === "terms"
      ? (DEFAULT_TERMS[companySlug] ?? DEFAULT_TERMS.websup)
      : (DEFAULT_PRIVACY[companySlug] ?? DEFAULT_PRIVACY.websup);
  const customContent = docType === "terms" ? company.termsContent : company.privacyContent;
  const content =
    customContent && customContent.trim().length > 0
      ? sanitizeContent(customContent)
      : defaultContent;

  const meta = COMPANY_META[companySlug] ?? COMPANY_META.websup;

  const buildElement = (docContent: string) =>
    createElement(LegalPDF, {
      companySlug,
      companyName: company.name,
      companyEmail: meta.email,
      companyWebsite: meta.website,
      companyAddress: meta.address,
      type: docType,
      content: docContent,
      version: "1.0",
      date: new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" }),
    });

  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(buildElement(content) as any);
  } catch (error) {
    console.error(
      `[legal-pdf] Render mislukt voor ${companySlug}/${docType} met opgeslagen content ` +
        `(lengte ${content.length}). Val terug op standaardtekst. Eerste 500 tekens: ` +
        JSON.stringify(content.slice(0, 500)),
      error
    );
    if (content === defaultContent) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(buildElement(defaultContent) as any);
  }

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
