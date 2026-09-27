import assert from "node:assert/strict";
import test from "node:test";
import { invoiceAmountMatches, invoiceCustomerPaymentUrl, invoiceMollieMode } from "../src/lib/mollie-invoice-validation";

test("betaalbevestiging vereist hetzelfde bedrag, valuta en test/live-modus", () => {
  const link = { mode: "test" as const, amount: { currency: "EUR", value: "120.50" } };
  assert.equal(invoiceAmountMatches(link, "120.50", "test"), true);
  assert.equal(invoiceAmountMatches(link, "120.51", "test"), false);
  assert.equal(invoiceAmountMatches(link, "120.50", "live"), false);
  assert.equal(invoiceAmountMatches({ ...link, amount: { currency: "USD", value: "120.50" } }, "120.50", "test"), false);
  assert.equal(invoiceAmountMatches({ ...link, amount: null }, "120.50", "test"), false);
  assert.equal(invoiceAmountMatches({ ...link, amount: { currency: "EUR", value: "geen bedrag" } }, "0.00", "test"), false);
});

test("Mollie-key bepaalt de modus zonder een onbekend prefix toe te laten", () => {
  assert.equal(invoiceMollieMode("test_example"), "test");
  assert.equal(invoiceMollieMode("live_example"), "live");
  assert.throws(() => invoiceMollieMode("unknown_example"));
});

test("klantfactuur toont alleen een live HTTPS-betaallink", () => {
  const invoice = { status: "VERZONDEN", molliePaymentMode: "live", molliePaymentUrl: "https://payment-links.mollie.com/payment/example" };
  assert.equal(invoiceCustomerPaymentUrl(invoice), invoice.molliePaymentUrl);
  assert.equal(invoiceCustomerPaymentUrl({ ...invoice, molliePaymentMode: "test" }), null);
  assert.equal(invoiceCustomerPaymentUrl({ ...invoice, status: "BETAALD" }), null);
  assert.equal(invoiceCustomerPaymentUrl({ ...invoice, status: "CONCEPT" }), null);
  assert.equal(invoiceCustomerPaymentUrl({ ...invoice, molliePaymentUrl: "http://example.com" }), null);
  assert.equal(invoiceCustomerPaymentUrl({ ...invoice, molliePaymentUrl: null }), null);
});
