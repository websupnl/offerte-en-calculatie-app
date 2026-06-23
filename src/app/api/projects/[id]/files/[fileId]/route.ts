import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, fileId } = await params;

  // Bevestig dat bestand bij een project van dit bedrijf hoort.
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id, project: { companyId: session.user.activeCompanyId } },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Eerst uit MinIO, dan uit DB. Faalt MinIO, dan stoppen we (geen weesrecord).
  if (isStorageConfigured()) {
    try {
      await deleteObject(file.objectKey);
    } catch {
      return NextResponse.json({ error: "Verwijderen uit storage mislukt" }, { status: 502 });
    }
  }

  await prisma.projectFile.delete({ where: { id: fileId } });
  return NextResponse.json({ ok: true });
}
