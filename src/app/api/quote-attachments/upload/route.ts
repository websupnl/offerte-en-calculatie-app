import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildObjectKey,
  deleteObject,
  isStorageConfigured,
  presignDownload,
  uploadObject,
} from "@/lib/storage";
import {
  createQuoteAttachmentStorageRef,
  getQuoteAttachmentStorageKey,
} from "@/lib/quote-attachments";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "S3-opslag is niet geconfigureerd" },
      { status: 503 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const title = file.name.replace(/\.[^.]+$/, "") || "offerte-afbeelding";
  const key = buildObjectKey(
    `${title}.${ext}`,
    `offertes/${session.user.activeCompanyId}`,
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, bytes, file.type);
  const previewUrl = await presignDownload(key, 3600);

  return NextResponse.json({
    url: createQuoteAttachmentStorageRef(key),
    previewUrl,
    title,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "S3-opslag is niet geconfigureerd" }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as { url?: string } | null;
  const key = body?.url ? getQuoteAttachmentStorageKey(body.url) : null;
  const companyPrefix = `offertes/${session.user.activeCompanyId}/`;

  if (!key || !key.startsWith(companyPrefix)) {
    return NextResponse.json({ error: "Ongeldige opslagverwijzing" }, { status: 400 });
  }

  await deleteObject(key);
  return NextResponse.json({ ok: true });
}
