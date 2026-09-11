/**
 * Het akkoord-record bij een offerte.
 *
 * QuoteEvent houdt de tijdlijn bij (mag bewerkt/verwijderd worden). AgreementLog
 * is het juridische record: alleen insert, met een bevroren snapshot van de
 * offerte zoals de klant hem accepteerde. Beide worden bij een akkoord geschreven.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Fallback als een bedrijf geen eigen AV-versie in de instellingen heeft staan. */
export const DEFAULT_AV_VERSION = "2026-09";

export function avVersionFor(company: { settings?: unknown } | null | undefined): string {
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const value = typeof settings.avVersion === "string" ? settings.avVersion.trim() : "";
  return value || DEFAULT_AV_VERSION;
}

/** Eerste IP uit x-forwarded-for (Vercel), anders x-real-ip. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

/** Publieke URL naar de algemene voorwaarden van een bedrijf. */
export function termsUrlFor(companySlug: string): string {
  return `/api/legal/${companySlug}/terms`;
}

export type WriteAgreementLogInput = {
  quoteId: string;
  companyId: string;
  method: "DIGITAL" | "VERBAL_CONFIRMED" | "EMAIL_ACCEPTANCE";
  ip?: string | null;
  avVersion?: string | null;
  snapshot: Prisma.InputJsonValue;
};

export async function writeAgreementLog(db: DbClient, input: WriteAgreementLogInput) {
  return db.agreementLog.create({
    data: {
      quoteId: input.quoteId,
      companyId: input.companyId,
      method: input.method,
      ip: input.ip ?? null,
      avVersion: input.avVersion ?? DEFAULT_AV_VERSION,
      snapshot: input.snapshot,
    },
  });
}
