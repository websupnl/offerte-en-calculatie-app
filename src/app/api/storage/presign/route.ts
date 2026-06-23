import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  STORAGE_BUCKET,
  buildObjectKey,
  isStorageConfigured,
  presignDownload,
  presignUpload,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Vraag een presigned PUT-URL aan zodat de browser rechtstreeks naar MinIO
 * uploadt (handig voor grotere bestanden — server hoeft de bytes niet door te
 * sluizen). Let op: hiervoor moet CORS op de bucket je app-domein toestaan.
 *
 * Body: { name: string, contentType: string, prefix?: string }
 * Retour: { key, uploadUrl, downloadUrl }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Storage niet geconfigureerd (MINIO_* env vars ontbreken)" },
      { status: 503 },
    );
  }

  let body: { name?: string; contentType?: string; prefix?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, contentType, prefix: prefixRaw } = body;
  if (!name || !contentType) {
    return NextResponse.json(
      { error: "name en contentType zijn verplicht" },
      { status: 400 },
    );
  }

  const prefix = prefixRaw
    ? prefixRaw.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120) || undefined
    : undefined;

  const key = buildObjectKey(name, prefix);
  const uploadUrl = await presignUpload(key, contentType, 300);
  const downloadUrl = await presignDownload(key, 3600);

  return NextResponse.json({ key, bucket: STORAGE_BUCKET, uploadUrl, downloadUrl });
}
