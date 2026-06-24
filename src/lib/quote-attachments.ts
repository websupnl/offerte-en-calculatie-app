import {
  STORAGE_BUCKET,
  isStorageConfigured,
  presignDownload,
} from "@/lib/storage";

const STORAGE_REF_PREFIX = "s3://";

export function createQuoteAttachmentStorageRef(key: string): string {
  return `${STORAGE_REF_PREFIX}${STORAGE_BUCKET}/${key}`;
}

export function getQuoteAttachmentStorageKey(value: string): string | null {
  if (!value.startsWith(STORAGE_REF_PREFIX)) return null;

  const withoutScheme = value.slice(STORAGE_REF_PREFIX.length);
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex < 1) return null;

  const bucket = withoutScheme.slice(0, slashIndex);
  const key = withoutScheme.slice(slashIndex + 1);
  if (bucket !== STORAGE_BUCKET || !key) return null;

  return key;
}

export async function resolveQuoteAttachmentImageUrl(
  imageUrl: string,
  expiresIn = 3600,
): Promise<string> {
  const key = getQuoteAttachmentStorageKey(imageUrl);
  if (!key || !isStorageConfigured()) return imageUrl;
  return presignDownload(key, expiresIn);
}

export async function resolveQuoteAttachmentImages<
  T extends { imageUrl: string },
>(
  attachments: T[],
  options: { expiresIn?: number; includeStorageRef?: boolean } = {},
): Promise<Array<T & { storageRef?: string }>> {
  const { expiresIn = 3600, includeStorageRef = false } = options;

  return Promise.all(
    attachments.map(async (attachment) => {
      const storageRef = getQuoteAttachmentStorageKey(attachment.imageUrl)
        ? attachment.imageUrl
        : undefined;
      const imageUrl = await resolveQuoteAttachmentImageUrl(
        attachment.imageUrl,
        expiresIn,
      );

      return {
        ...attachment,
        imageUrl,
        ...(includeStorageRef && storageRef ? { storageRef } : {}),
      };
    }),
  );
}
