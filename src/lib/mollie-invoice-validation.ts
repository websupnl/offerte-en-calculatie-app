import { toCents } from "@/lib/money";

export function invoiceMollieMode(key: string): "test" | "live" {
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  throw new Error("Ongeldige Mollie API-key");
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
