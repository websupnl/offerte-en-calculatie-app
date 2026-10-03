import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteEmailHtml, buildQuoteExtendedEmailContent, getCompanyEmailIdentity, renderEmailShell } from "../src/lib/email";
import { defaultQuoteExtensionMessage, defaultQuoteExtensionSubject } from "../src/lib/quote-email-copy";

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

test("bewerkte verlengmail behoudt automatisch nummer, datum en portaalknop", () => {
  const email = buildQuoteExtendedEmailContent({
    to: "klant@example.test",
    companySlug: "koolhaas",
    customerName: "Daan",
    quoteNumber: "KI-2026-0015",
    quoteTitle: "Voorstel",
    validUntil: new Date("2026-10-11T12:00:00Z"),
    portalUrl: "https://offerte.websup.nl/q/voorbeeld",
    subject: "Aangepast onderwerp",
    message: "Een persoonlijke toelichting.\nTweede regel <controle>.",
  });
  assert.equal(email.subject, "Aangepast onderwerp");
  assert.match(email.html, /Een persoonlijke toelichting\.<br \/>Tweede regel &lt;controle&gt;\./);
  assert.match(email.html, /Offerte <strong>KI-2026-0015<\/strong>/);
  assert.match(email.html, /11 oktober 2026/);
  assert.match(email.html, /Offerte bekijken/);
  assert.match(email.text, /Een persoonlijke toelichting\.\nTweede regel <controle>\./);
  assert.match(email.text, /Offerte bekijken: https:\/\/offerte\.websup\.nl\/q\/voorbeeld/);
});

test("verlengmail heeft per bedrijf een passende standaardtekst", () => {
  assert.match(defaultQuoteExtensionSubject("koolhaas", "KI-1"), /^Uw offerte KI-1/);
  assert.match(defaultQuoteExtensionSubject("websup", "WS-1"), /^Je offerte WS-1/);
  assert.match(defaultQuoteExtensionMessage("koolhaas"), /voor u/);
  assert.match(defaultQuoteExtensionMessage("websup"), /voor je/);
});
