import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteEmailHtml, getCompanyEmailIdentity, renderEmailShell } from "../src/lib/email";

test("klantmails delen dezelfde responsieve licht/donker-basis", () => {
  const identity = getCompanyEmailIdentity("koolhaas");
  const quote = buildQuoteEmailHtml(identity, {
    to: "klant@example.test",
    customerName: "Daan",
    companySlug: "koolhaas",
    quoteNumber: "KI-2026-0014",
    quoteUrl: "https://example.test/q/token",
    introLine: "Hierbij de offerte.",
  });
  const followUp = renderEmailShell(identity, { bodyHtml: "<p>De offerte is verlengd.</p>" });

  for (const html of [quote, followUp]) {
    assert.match(html, /class="email-card"/);
    assert.match(html, /class="email-header"/);
    assert.match(html, /class="email-content email-copy"/);
    assert.match(html, /max-width:480px/);
    assert.match(html, /prefers-color-scheme:dark/);
    assert.match(html, /\[data-ogsc\]/);
    assert.match(html, /font-size:16px/);
  }
  assert.match(quote, /Offerte bekijken/);
  assert.doesNotMatch(quote, /Veilig &amp; betrouwbaar|Deskundig advies op maat/);
});

test("klantinhoud wordt ge-escaped in de offertemail", () => {
  const html = buildQuoteEmailHtml(getCompanyEmailIdentity("websup"), {
    to: "klant@example.test",
    customerName: "<Klant>",
    companySlug: "websup",
    quoteNumber: "WS-1",
    quoteUrl: "https://example.test/q/?a=1&b=2",
    introLine: "Bekijk <de> offerte",
    attachments: [{ filename: "<bijlage>.pdf", content: Buffer.alloc(0) }],
  });
  assert.match(html, /Hoi &lt;Klant&gt;/);
  assert.match(html, /Bekijk &lt;de&gt; offerte/);
  assert.match(html, /&lt;bijlage&gt;\.pdf/);
  assert.match(html, /\?a=1&amp;b=2/);
});
