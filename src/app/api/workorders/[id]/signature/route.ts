import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, presignDownload, uploadObject } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  // PNG als data-URL: "data:image/png;base64,...."
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "Verwacht PNG data-URL"),
  signedBy: z.string().min(1, "Naam ondertekenaar verplicht"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Storage niet geconfigureerd (MINIO_* env vars ontbreken)" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true, status: true },
  });
  if (!workOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const base64 = parsed.data.dataUrl.replace(/^data:image\/png;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const key = `werkbonnen/${id}/handtekening.png`;
  await uploadObject(key, bytes, "image/png");

  await prisma.workOrder.update({
    where: { id },
    data: {
      signatureKey: key,
      signedBy: parsed.data.signedBy,
      signedAt: new Date(),
      // Ondertekend = uitgevoerd (tenzij al gefactureerd).
      status: workOrder.status === "GEFACTUREERD" ? "GEFACTUREERD" : "UITGEVOERD",
      executedAt: new Date(),
    },
  });

  const url = await presignDownload(key, 3600);
  return NextResponse.json({ ok: true, signatureUrl: url });
}

/** Handtekening verwijderen (opnieuw laten tekenen). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.workOrder.updateMany({
    where: { id, companyId: session.user.activeCompanyId },
    data: { signatureKey: null, signedBy: null, signedAt: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
