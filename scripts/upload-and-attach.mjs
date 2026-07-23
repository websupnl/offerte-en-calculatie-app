import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

process.chdir("/home/daan-koolhaas/Documenten/GitHub/offerte-en-calculatie-app");

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && !key.startsWith("#") && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
}
loadEnv();

const bucket = process.env.MINIO_BUCKET;
const client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: process.env.MINIO_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const companyId = "cmpv4v78x00017kubf2jpv6n4"; // koolhaas

async function upload(localPath, ext, contentType) {
  const key = `offertes/${companyId}/${randomUUID()}.${ext}`;
  const body = readFileSync(localPath);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return `s3://${bucket}/${key}`;
}

const SC = "/tmp/claude-1000/-home-daan-koolhaas/c887bb5d-f486-4e44-857c-8f5f37bb7964/scratchpad";
const growattRef = await upload(`${SC}/growatt-apx.png`, "png", "image/png");
const ecoflowRef = await upload(`${SC}/ecoflow-ocean2.png`, "png", "image/png");

console.log(JSON.stringify({ growattRef, ecoflowRef }, null, 2));
