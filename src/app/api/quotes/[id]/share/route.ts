import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePortalPdf } from "@/lib/pdf/generate-and-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      company: true,
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const share = await prisma.quoteShare.upsert({
    where: { quoteId: id },
    create: { quoteId: id },
    update: {},
  });

  // Een deellink ophalen is geen verzending. De status blijft staan; "Verstuurd"
  // wordt alleen gezet door een echte e-mail via de app (send-email) of door de
  // knop "Markeer als verstuurd".

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/q/${share.token}`;

  // Pre-generate portal PDF in background so it's ready when customer opens the link
  const host = req.headers.get("host") ?? "localhost:3000";
  after(async () => {
    await generateAndStorePortalPdf(share.token, host);
  });

  return NextResponse.json({ token: share.token, url });
}
