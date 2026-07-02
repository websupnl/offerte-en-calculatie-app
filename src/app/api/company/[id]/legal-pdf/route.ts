import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildObjectKey,
  deleteObject,
  isStorageConfigured,
  uploadObject,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const DOCUMENT_TYPES = ["terms", "privacy"] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && DOCUMENT_TYPES.includes(value as DocumentType);
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function verifyAccess(companyId: string, userId: string) {
  return prisma.companyUser.findFirst({
    where: { userId, companyId },
    select: { companyId: true },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "S3-opslag is niet geconfigureerd" }, { status: 503 });
  }

  const { id } = await params;
  const access = await verifyAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const type = formData.get("type");
  const file = formData.get("file");

  if (!isDocumentType(type)) {
    return NextResponse.json({ error: "Ongeldig documenttype" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF-bestand ontbreekt" }, { status: 400 });
  }

  if (!isPdf(file)) {
    return NextResponse.json({ error: "Upload alleen PDF-bestanden" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "PDF is groter dan 15 MB" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      termsPdfKey: true,
      privacyPdfKey: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });

  const key = buildObjectKey(file.name, `juridisch/${id}/${type}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, bytes, "application/pdf");

  const previousKey = type === "terms" ? company.termsPdfKey : company.privacyPdfKey;
  if (previousKey) {
    await deleteObject(previousKey).catch(() => undefined);
  }

  const data =
    type === "terms"
      ? { termsPdfKey: key, termsPdfName: file.name, termsPdfSize: file.size }
      : { privacyPdfKey: key, privacyPdfName: file.name, privacyPdfSize: file.size };

  await prisma.company.update({ where: { id }, data });

  return NextResponse.json({
    ok: true,
    document: {
      type,
      name: file.name,
      size: file.size,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "S3-opslag is niet geconfigureerd" }, { status: 503 });
  }

  const { id } = await params;
  const access = await verifyAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type } = await req.json().catch(() => ({ type: null }));
  if (!isDocumentType(type)) {
    return NextResponse.json({ error: "Ongeldig documenttype" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      termsPdfKey: true,
      privacyPdfKey: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });

  const key = type === "terms" ? company.termsPdfKey : company.privacyPdfKey;
  if (key) {
    await deleteObject(key).catch(() => undefined);
  }

  const data =
    type === "terms"
      ? { termsPdfKey: null, termsPdfName: null, termsPdfSize: null }
      : { privacyPdfKey: null, privacyPdfName: null, privacyPdfSize: null };

  await prisma.company.update({ where: { id }, data });

  return NextResponse.json({ ok: true });
}
