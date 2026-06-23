import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildObjectKey,
  isStorageConfigured,
  presignDownload,
  uploadObject,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const VALID_CATEGORIES = ["OFFERTE", "WERKBON", "FACTUUR", "FOTO", "OVERIG"];

/** Controleer dat het project bij het actieve bedrijf hoort. */
async function getOwnedProject(projectId: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getOwnedProject(id, session.user.activeCompanyId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await prisma.projectFile.findMany({
    where: { projectId: id },
    orderBy: { uploadedAt: "desc" },
  });

  // Verse presigned downloadlinks meegeven (objecten zijn privaat).
  const withUrls = await Promise.all(
    files.map(async (f) => ({
      ...f,
      url: isStorageConfigured() ? await presignDownload(f.objectKey, 3600) : null,
    })),
  );

  return NextResponse.json(withUrls);
}

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
  const project = await getOwnedProject(id, session.user.activeCompanyId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  const categoryRaw = formData.get("category");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  const category =
    typeof categoryRaw === "string" && VALID_CATEGORIES.includes(categoryRaw)
      ? categoryRaw
      : "OVERIG";

  const key = buildObjectKey(file.name, `projecten/${id}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, bytes, file.type || "application/octet-stream");

  const record = await prisma.projectFile.create({
    data: {
      projectId: id,
      name: file.name,
      objectKey: key,
      mimeType: file.type || null,
      size: file.size,
      category,
    },
  });

  const url = await presignDownload(key, 3600);
  return NextResponse.json({ ...record, url }, { status: 201 });
}
