import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";

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
  if (branding.gradient !== undefined) {
    const gradient = branding.gradient;
    if (!gradient || typeof gradient !== "object" || ["from", "via", "to"].some((key) => typeof gradient[key] !== "string" || !/^#[\da-f]{6}$/i.test(gradient[key]))) {
      return NextResponse.json({ error: "Vul drie geldige hexkleuren in voor de gradient." }, { status: 400 });
    }
    if (typeof gradient.angle !== "number" || !Number.isFinite(gradient.angle) || gradient.angle < 0 || gradient.angle > 360 || typeof gradient.viaPosition !== "number" || !Number.isFinite(gradient.viaPosition) || gradient.viaPosition < 1 || gradient.viaPosition > 99) {
      return NextResponse.json({ error: "Gebruik een richting van 0 tot 360 graden en een middenpositie van 1 tot 99%." }, { status: 400 });
    }
  }
  if (typeof branding.font !== "string" || !["Inter", "Nunito", "Sora", "Bricolage Grotesque", "Arial"].includes(branding.font)) {
    return NextResponse.json({ error: "Kies een geldig lettertype" }, { status: 400 });
  }
  if (typeof branding.logoUrl !== "string" || typeof branding.faviconUrl !== "string") {
    return NextResponse.json({ error: "Selecteer een logo en favicon" }, { status: 400 });
  }

  const currentCompany = await prisma.company.findUnique({ where: { id }, select: { slug: true, branding: true } });
  if (!currentCompany) return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });
  const nextBranding = getBranding(currentCompany.slug, { ...((currentCompany.branding ?? {}) as object), ...branding });
  const brandingChanged = JSON.stringify(currentCompany.branding ?? {}) !== JSON.stringify(nextBranding);
  // Portal-PDF's kunnen de oude huisstijl uit cache tonen. Laat ze na een
  // brandingwijziging opnieuw opbouwen bij het volgende downloadverzoek.
  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id }, data: { settings, branding: nextBranding } });
    if (brandingChanged) {
      await tx.quote.updateMany({ where: { companyId: id }, data: { pdfUrl: null } });
      await tx.quoteShare.updateMany({ where: { quote: { companyId: id } }, data: { portalPdfUrl: null } });
    }
  });

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
