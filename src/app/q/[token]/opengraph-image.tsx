import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { getQuoteAttachmentStorageKey } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function mimeFor(filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

async function logoData(logoUrl: string, companyId: string): Promise<string | null> {
  try {
    if (logoUrl.startsWith("s3://")) {
      const key = getQuoteAttachmentStorageKey(logoUrl);
      if (!key || !key.startsWith(`branding/${companyId}/logo.`) || !isStorageConfigured()) return null;
      const response = await fetch(await presignDownload(key, 300));
      if (!response.ok) return null;
      const data = Buffer.from(await response.arrayBuffer()).toString("base64");
      return `data:${mimeFor(key)};base64,${data}`;
    }

    const relativePath = logoUrl.replace(/^\//, "");
    if (!relativePath.startsWith("logos/")) return null;
    const data = await readFile(join(process.cwd(), "public", relativePath));
    return `data:${mimeFor(relativePath)};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function QuoteOpenGraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await prisma.quoteShare.findUnique({
    where: { token },
    select: {
      quote: {
        select: {
          title: true,
          number: true,
          company: { select: { id: true, name: true, slug: true, branding: true } },
        },
      },
    },
  });

  const company = share?.quote.company;
  const branding = company
    ? getBranding(company.slug, (company.branding ?? {}) as Record<string, string>)
    : null;
  const logo = company && branding
    ? (await logoData(branding.logoUrl, company.id)) ?? await logoData(
        company.slug === "koolhaas" ? "/logos/koolhaas-logo.png" : "/logos/websup-wordmark-black.png",
        company.id,
      )
    : null;
  const companyName = company?.name ?? "Offerte";
  const quoteTitle = share?.quote.title?.trim() || share?.quote.number || "Persoonlijk voorstel";
  const primaryColor = branding?.primaryColor ?? "#0b1526";
  const accentColor = branding?.accentColor ?? "#f97316";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "#f8f9fc",
          color: primaryColor,
          fontFamily: "Arial, sans-serif",
          borderTop: `18px solid ${accentColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              width: 260,
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            {logo ? <img src={logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 740 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#64748b" }}>
              {companyName}
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 54, lineHeight: 1.12, fontWeight: 700 }}>
              {quoteTitle}
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#475569" }}>
              Offerte bekijken
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
