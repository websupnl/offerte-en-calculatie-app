import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * MinIO / S3 storage helper.
 * Draait op de VPS naast Coolify. Bestanden komen via presigned URLs of via
 * een API-route binnen. Endpoint + keys via env (zie .env.example).
 */

const endpoint = process.env.MINIO_ENDPOINT;
const accessKeyId = process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_SECRET_KEY;

export const STORAGE_BUCKET = process.env.MINIO_BUCKET ?? "koolhaas-bestanden";

let client: S3Client | null = null;

/** Lazy singleton — gooit pas als storage daadwerkelijk gebruikt wordt. */
export function getStorageClient(): S3Client {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "MinIO niet geconfigureerd: zet MINIO_ENDPOINT, MINIO_ACCESS_KEY en MINIO_SECRET_KEY.",
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint,
      region: process.env.MINIO_REGION ?? "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
      // MinIO heeft path-style nodig (geen virtual-hosted bucket subdomeinen).
      forcePathStyle: true,
    });
  }
  return client;
}

export function isStorageConfigured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

/**
 * Genereer een unieke object-key. Optioneel prefix (bijv. "projecten/<id>").
 * Behoudt de extensie van de originele bestandsnaam.
 */
export function buildObjectKey(originalName: string, prefix?: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(originalName);
  const ext = match ? `.${match[1].toLowerCase()}` : "";
  const name = `${randomUUID()}${ext}`;
  return prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name;
}

/** Upload een buffer direct (server-side). Geeft de object-key terug. */
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
  bucket: string = STORAGE_BUCKET,
): Promise<string> {
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Presigned PUT-URL — browser uploadt rechtstreeks naar MinIO.
 * Geef dezelfde contentType door bij de daadwerkelijke PUT.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
  bucket: string = STORAGE_BUCKET,
): Promise<string> {
  return getSignedUrl(
    getStorageClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/** Presigned GET-URL — tijdelijke downloadlink voor een privaat object. */
export async function presignDownload(
  key: string,
  expiresIn = 300,
  bucket: string = STORAGE_BUCKET,
): Promise<string> {
  return getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}

export async function downloadObject(
  key: string,
  bucket: string = STORAGE_BUCKET,
): Promise<Buffer> {
  const response = await getStorageClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`Object heeft geen inhoud: ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObject(
  key: string,
  bucket: string = STORAGE_BUCKET,
): Promise<void> {
  await getStorageClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}

/** Bestaat het object? Handig voor verificatie na een presigned upload. */
export async function objectExists(
  key: string,
  bucket: string = STORAGE_BUCKET,
): Promise<boolean> {
  try {
    await getStorageClient().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}
