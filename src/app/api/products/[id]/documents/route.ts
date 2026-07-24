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
const VALID_TYPES = ["DATASHEET", "BROCHURE"];

async function getOwnedProduct(productId: string, companyId: string) {
  return prisma.product.findFirst({ where: { id: productId, companyId }, select: { id: true } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await getOwnedProduct(id, session.user.activeCompanyId);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documents = await prisma.productDocument.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    documents.map(async (d) => ({
      ...d,
      url: isStorageConfigured() ? await presignDownload(d.objectKey, 3600) : null,
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
  const product = await getOwnedProduct(id, session.user.activeCompanyId);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  const typeRaw = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Bestand ontbreekt" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Bestand te groot (max 25MB)" }, { status: 400 });
  }

  const type = typeof typeRaw === "string" && VALID_TYPES.includes(typeRaw) ? typeRaw : "DATASHEET";

  const key = buildObjectKey(file.name, `datasheets/${session.user.activeCompanyId}/${id}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, bytes, file.type || "application/octet-stream");

  const record = await prisma.productDocument.create({
    data: {
      companyId: session.user.activeCompanyId,
      productId: id,
      name: file.name,
      objectKey: key,
      mimeType: file.type || null,
      size: file.size,
      type: type as "DATASHEET" | "BROCHURE",
    },
  });

  const url = await presignDownload(key, 3600);
  return NextResponse.json({ ...record, url }, { status: 201 });
}
