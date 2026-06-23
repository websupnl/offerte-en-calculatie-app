import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  STORAGE_BUCKET,
  buildObjectKey,
  isStorageConfigured,
  presignDownload,
  uploadObject,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — foto's/bonnen/PDF's

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

  const formData = await req.formData();
  const file = formData.get("file");
  const prefixRaw = formData.get("prefix");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  // Prefix beperken tot veilige tekens, zodat de key niet te knoeien is.
  const prefix =
    typeof prefixRaw === "string"
      ? prefixRaw.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120) || undefined
      : undefined;

  const key = buildObjectKey(file.name, prefix);
  const bytes = Buffer.from(await file.arrayBuffer());

  await uploadObject(key, bytes, file.type || "application/octet-stream");

  // Tijdelijke downloadlink terug (objecten zijn privaat).
  const url = await presignDownload(key, 3600);

  return NextResponse.json({
    key,
    bucket: STORAGE_BUCKET,
    url,
    name: file.name,
    mimeType: file.type || null,
    size: file.size,
  });
}
