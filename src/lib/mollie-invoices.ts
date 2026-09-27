import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invoiceAmountMatches, invoiceMollieMode } from "@/lib/mollie-invoice-validation";
export { invoiceAmountMatches, invoiceMollieMode } from "@/lib/mollie-invoice-validation";

const linkSchema = z.object({
  id: z.string().startsWith("pl_"),
  mode: z.enum(["test", "live"]),
  amount: z.object({ currency: z.string(), value: z.string() }).nullable(),
  paidAt: z.string().nullable(),
  archived: z.boolean().optional(),
  _links: z.object({ paymentLink: z.object({ href: z.string().url() }) }).optional(),
});

export type MollieInvoiceLink = z.infer<typeof linkSchema>;

/** Koppel iedere bedrijfsnaam expliciet aan de bedoelde Mollie-key/profiel. */
export function invoiceMollieKey(companySlug: string): string | null {
  if (companySlug === "websup") return process.env.MOLLIE_API_KEY_WEBSUP || null;
  if (companySlug === "koolhaas") return process.env.MOLLIE_API_KEY_KOOLHAAS || null;
  return null;
}

export async function mollieInvoiceRequest(
  key: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<MollieInvoiceLink> {
  const response = await fetch(`https://api.mollie.com/v2/${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Mollie gaf HTTP ${response.status}`);
  return linkSchema.parse(await response.json());
}

type PayableInvoice = {
  id: string;
  companyId: string;
  number: string;
  totalIncVat: { toString(): string };
  molliePaymentLinkId: string | null;
  molliePaymentUrl: string | null;
  molliePaymentMode: string | null;
  company: { slug: string };
};

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

/** Maakt hoogstens één Mollie-betaallink aan voor een definitieve factuur. */
export async function ensureInvoicePaymentLink(invoice: PayableInvoice) {
  if (invoice.molliePaymentLinkId && invoice.molliePaymentUrl) {
    if (!isHttpsUrl(invoice.molliePaymentUrl)) throw new Error("De opgeslagen betaallink is ongeldig");
    const key = invoiceMollieKey(invoice.company.slug);
    if (!key) throw new Error("Mollie is voor dit bedrijf nog niet ingesteld");
    const existing = await mollieInvoiceRequest(key, `payment-links/${invoice.molliePaymentLinkId}`);
    if (!invoiceAmountMatches(existing, invoice.totalIncVat, invoice.molliePaymentMode ?? "") || existing.archived || existing.paidAt) {
      throw new Error("De bestaande betaallink is niet meer bruikbaar voor deze factuur");
    }
    return { url: invoice.molliePaymentUrl, mode: existing.mode };
  }
  const key = invoiceMollieKey(invoice.company.slug);
  if (!key) throw new Error("Mollie is voor dit bedrijf nog niet ingesteld");
  const mode = invoiceMollieMode(key);
  if (process.env.NODE_ENV !== "production" && mode === "live") {
    throw new Error("Gebruik lokaal een Mollie-testkey");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !appUrl.startsWith("https://")) {
    throw new Error("Een publieke HTTPS-app-URL is nodig voor Mollie-webhooks");
  }
  const link = await mollieInvoiceRequest(key, "payment-links", {
    method: "POST",
    idempotencyKey: `sales-invoice-${invoice.id}`,
    body: {
      description: `Factuur ${invoice.number}`,
      amount: { currency: "EUR", value: Number(invoice.totalIncVat).toFixed(2) },
      webhookUrl: `${appUrl.replace(/\/$/, "")}/api/webhooks/mollie-invoices/${invoice.id}`,
      reusable: false,
    },
  });
  const url = link._links?.paymentLink.href;
  if (!url || !isHttpsUrl(url) || !invoiceAmountMatches(link, invoice.totalIncVat, mode)) {
    throw new Error("Ongeldige reactie van Mollie");
  }
  const { count } = await prisma.salesInvoice.updateMany({
    where: { id: invoice.id, companyId: invoice.companyId, molliePaymentLinkId: null, status: { in: ["GEREED", "VERZENDEN", "VERZONDEN", "VERVALLEN"] } },
    data: { molliePaymentLinkId: link.id, molliePaymentUrl: url, molliePaymentMode: link.mode },
  });
  if (!count) {
    const current = await prisma.salesInvoice.findUnique({
      where: { id: invoice.id },
      select: { molliePaymentUrl: true, molliePaymentMode: true },
    });
    if (current?.molliePaymentUrl) return { url: current.molliePaymentUrl, mode: current.molliePaymentMode };
    throw new Error("Factuurstatus is ondertussen gewijzigd");
  }
  return { url, mode: link.mode };
}
