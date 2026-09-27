import "server-only";

import { z } from "zod";
export { invoiceAmountMatches, invoiceMollieMode } from "@/lib/mollie-invoice-validation";

const linkSchema = z.object({
  id: z.string().startsWith("pl_"),
  mode: z.enum(["test", "live"]),
  amount: z.object({ currency: z.string(), value: z.string() }).nullable(),
  paidAt: z.string().nullable(),
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
