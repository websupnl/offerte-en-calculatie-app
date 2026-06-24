import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const switchCompanySchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const parsed = switchCompanySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }

  const membership = await prisma.companyUser.findUnique({
    where: {
      userId_companyId: {
        userId: session.user.id,
        companyId: parsed.data.companyId,
      },
    },
    select: { companyId: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Je hebt geen toegang tot dit bedrijf" },
      { status: 403 },
    );
  }

  const updatedSession = await updateSession({
    user: { activeCompanyId: membership.companyId },
  });

  if (updatedSession?.user?.activeCompanyId !== membership.companyId) {
    return NextResponse.json(
      { error: "Bedrijfswissel kon niet worden opgeslagen" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    activeCompanyId: updatedSession.user.activeCompanyId,
  });
}
