import { toCents } from "@/lib/money";

export function invoiceMollieMode(key: string): "test" | "live" {
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  throw new Error("Ongeldige Mollie API-key");
}

/** Alleen een live HTTPS-link mag op een klantfactuur of in de PDF verschijnen. */
export function invoiceCustomerPaymentUrl(invoice: {
  status: string;
  molliePaymentMode: string | null;
  molliePaymentUrl: string | null;
}): string | null {
  if (!["GEREED", "VERZENDEN", "VERZONDEN", "VERVALLEN"].includes(invoice.status)
    || invoice.molliePaymentMode !== "live" || !invoice.molliePaymentUrl) return null;
  try {
    const url = new URL(invoice.molliePaymentUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function invoiceAmountMatches(
  link: { mode: "test" | "live"; amount: { currency: string; value: string } | null },
  total: unknown,
  expectedMode: string,
): boolean {
  return link.mode === expectedMode
    && link.amount?.currency === "EUR"
    && /^\d+\.\d{2}$/.test(link.amount.value)
    && toCents(link.amount.value) === toCents(total);
}
