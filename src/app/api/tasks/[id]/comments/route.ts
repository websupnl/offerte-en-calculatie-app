import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  body: z.string().min(1, "Bericht mag niet leeg zijn"),
  // INTERNAL op een gedeelde taak = mijn eigen kladblok, klant ziet 'm niet.
  visibility: z.enum(["INTERNAL", "SHARED"]).default("INTERNAL"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        ...(session.user.activeCompanyId ? [{ companyId: session.user.activeCompanyId }] : []),
        { companyId: null, ownerId: session.user.id },
      ],
    },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      taskId: id,
      authorUserId: session.user.id,
      authorName: session.user.name ?? session.user.email ?? "Onbekend",
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
