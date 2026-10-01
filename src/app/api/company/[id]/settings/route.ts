import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify user has access to this company
  const access = await prisma.companyUser.findFirst({
    where: { userId: session.user.id, companyId: id },
  });
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { settings, branding } = await req.json();
  if (!branding || typeof branding !== "object") {
    return NextResponse.json({ error: "Ongeldige branding" }, { status: 400 });
  }
  for (const key of ["primaryColor", "accentColor", "backgroundColor", "textColor"] as const) {
    const value = branding[key];
    if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) {
      return NextResponse.json({ error: `Vul een geldige hexkleur in bij ${key}` }, { status: 400 });
    }
  }
  if (typeof branding.font !== "string" || !["Inter", "Nunito", "Sora", "Bricolage Grotesque", "Arial"].includes(branding.font)) {
    return NextResponse.json({ error: "Kies een geldig lettertype" }, { status: 400 });
  }
  if (typeof branding.logoUrl !== "string" || typeof branding.faviconUrl !== "string") {
    return NextResponse.json({ error: "Selecteer een logo en favicon" }, { status: 400 });
  }

  const currentCompany = await prisma.company.findUnique({ where: { id }, select: { branding: true } });
  const brandingChanged = JSON.stringify(currentCompany?.branding ?? {}) !== JSON.stringify(branding ?? {});
  await prisma.company.update({
    where: { id },
    data: { settings, branding },
  });
  // Portal-PDF's kunnen de oude huisstijl uit cache tonen. Laat ze na een
  // brandingwijziging opnieuw opbouwen bij het volgende downloadverzoek.
  if (brandingChanged) {
    await prisma.$transaction([
      prisma.quote.updateMany({ where: { companyId: id }, data: { pdfUrl: null } }),
      prisma.quoteShare.updateMany({ where: { quote: { companyId: id } }, data: { portalPdfUrl: null } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await prisma.companyUser.findFirst({
    where: { userId: session.user.id, companyId: id },
  });
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const company = await prisma.company.findUnique({ where: { id }, select: { slug: true, branding: true } });
  if (!company) return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });
  return NextResponse.json({ branding: company.branding, slug: company.slug });
}
