import assert from "node:assert/strict";
import test from "node:test";
import {
  bouwOpdrachtPayload,
  donnaBedrijf,
  meldOpdrachtBijDonna,
  naarCenten,
} from "../src/lib/donna-opdrachten";

const bron = {
  quoteId: "cmtq5uu9f000104iivosd7c31",
  quoteNumber: "KI-2026-0011",
  title: "Vervanging laadpunt en slimme energieregeling",
  customerName: "Bauke Braaksma",
  customerId: "klant-123",
  totalIncVat: 1842.3,
  acceptedAt: new Date("2026-09-08T09:40:42.581Z"),
  regels: [{ description: "Easee Charge Max leveren en aansluiten" }],
  appUrl: "https://app.websup.nl",
};

// ── Bedrijfsmapping ─────────────────────────────────────────────────────────

test("donnaBedrijf vertaalt de slugs van deze app naar die van Donna", () => {
  assert.equal(donnaBedrijf("koolhaas"), "koolhaas");
  assert.equal(donnaBedrijf("koolhaas-installaties"), "koolhaas");
  assert.equal(donnaBedrijf("websup"), "websup");
  assert.equal(donnaBedrijf("WebsUp"), "websup");
});

test("donnaBedrijf geeft null bij een onbekend bedrijf, zodat er niets verstuurd wordt", () => {
  assert.equal(donnaBedrijf("iets-anders"), null);
  assert.equal(donnaBedrijf(null), null);
});

// ── Bedragen ────────────────────────────────────────────────────────────────

test("naarCenten maakt hele centen van een bedrag", () => {
  assert.equal(naarCenten(8125), 812500);
  assert.equal(naarCenten(1842.3), 184230);
  assert.equal(naarCenten("1842.30"), 184230);
  assert.equal(naarCenten(0), 0);
});

test("naarCenten rondt af in plaats van af te kappen", () => {
  // 0.1 + 0.2 komt in drijvende komma uit op 0.30000000000000004.
  assert.equal(naarCenten(0.1 + 0.2), 30);
  assert.equal(naarCenten(19.995), 2000);
});

test("naarCenten laat onbekende of onzinnige bedragen weg", () => {
  assert.equal(naarCenten(null), undefined);
  assert.equal(naarCenten(undefined), undefined);
  assert.equal(naarCenten("geen getal"), undefined);
  assert.equal(naarCenten(-5), undefined);
});

// ── Payload ─────────────────────────────────────────────────────────────────

test("bouwOpdrachtPayload vult de verplichte velden", () => {
  const payload = bouwOpdrachtPayload(bron);
  assert.equal(payload.reference, bron.quoteId);
  assert.equal(payload.title, bron.title);
  assert.equal(payload.customerName, "Bauke Braaksma");
});

test("bouwOpdrachtPayload gebruikt het offerte-id als ontdubbelsleutel, niet het nummer", () => {
  // Het nummer kan in theorie wijzigen, het id nooit. Bij een tweede melding
  // moet Donna dezelfde sleutel zien, anders ontstaat er een tweede project.
  assert.equal(bouwOpdrachtPayload(bron).reference, bron.quoteId);
  assert.equal(bouwOpdrachtPayload({ ...bron, quoteNumber: "ANDERS" }).reference, bron.quoteId);
});

test("bouwOpdrachtPayload zet het bedrag in centen met valuta", () => {
  const payload = bouwOpdrachtPayload(bron);
  assert.equal(payload.amountCents, 184230);
  assert.equal(payload.currency, "EUR");
});

test("bouwOpdrachtPayload laat het bedrag weg als het onbekend is", () => {
  const payload = bouwOpdrachtPayload({ ...bron, totalIncVat: null });
  assert.equal("amountCents" in payload, false);
  assert.equal("currency" in payload, false);
});

test("bouwOpdrachtPayload stuurt alleen een https-link mee", () => {
  assert.equal(
    bouwOpdrachtPayload(bron).url,
    `https://app.websup.nl/quotes/${bron.quoteId}`,
  );
  // Lokaal draait de app op http; dan liever geen veld dan een 400 van Donna.
  assert.equal("url" in bouwOpdrachtPayload({ ...bron, appUrl: "http://localhost:3001" }), false);
  assert.equal("url" in bouwOpdrachtPayload({ ...bron, appUrl: null }), false);
});

test("bouwOpdrachtPayload valt terug op het offertenummer als er geen titel is", () => {
  assert.equal(bouwOpdrachtPayload({ ...bron, title: null }).title, "KI-2026-0011");
  assert.equal(bouwOpdrachtPayload({ ...bron, title: null, quoteNumber: null }).title, "Opdracht");
});

test("bouwOpdrachtPayload zet acceptedAt om naar ISO 8601", () => {
  assert.equal(bouwOpdrachtPayload(bron).acceptedAt, "2026-09-08T09:40:42.581Z");
});

// ── Versturen ───────────────────────────────────────────────────────────────

const nepAntwoord = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("meldOpdrachtBijDonna stuurt naar het juiste bedrijf met het geheim in de header", async () => {
  let gezien: { url: string; init: RequestInit } | null = null;
  const resultaat = await meldOpdrachtBijDonna("koolhaas", bouwOpdrachtPayload(bron), {
    secret: "geheim",
    fetchImpl: (async (url: string, init: RequestInit) => {
      gezien = { url, init };
      return nepAntwoord(201, { ok: true, projectId: "p1" });
    }) as unknown as typeof fetch,
  });

  assert.equal(resultaat.status, "verstuurd");
  assert.equal(gezien!.url, "https://emma.onlinewerkplek.cloud/api/opdrachten/koolhaas");
  assert.equal(gezien!.init.method, "POST");
  assert.equal(
    (gezien!.init.headers as Record<string, string>)["x-donna-opdrachten-secret"],
    "geheim",
  );
});

test("meldOpdrachtBijDonna herkent een dubbele melding als succes", async () => {
  const resultaat = await meldOpdrachtBijDonna("websup", bouwOpdrachtPayload(bron), {
    secret: "geheim",
    fetchImpl: (async () => nepAntwoord(200, { ok: true, duplicate: true })) as unknown as typeof fetch,
  });
  assert.deepEqual(
    { status: resultaat.status, duplicaat: (resultaat as { duplicaat: boolean }).duplicaat },
    { status: "verstuurd", duplicaat: true },
  );
});

test("meldOpdrachtBijDonna slaat over als het geheim niet gezet is, zonder te crashen", async () => {
  let geroepen = false;
  const resultaat = await meldOpdrachtBijDonna("koolhaas", bouwOpdrachtPayload(bron), {
    secret: null,
    fetchImpl: (async () => {
      geroepen = true;
      return nepAntwoord(201, {});
    }) as unknown as typeof fetch,
  });
  assert.equal(resultaat.status, "overgeslagen");
  assert.equal(geroepen, false);
});

test("meldOpdrachtBijDonna probeert niet opnieuw bij een afwijzing van Donna zelf", async () => {
  // 401 of 400 wordt bij een tweede poging exact hetzelfde antwoord.
  let pogingen = 0;
  const resultaat = await meldOpdrachtBijDonna("koolhaas", bouwOpdrachtPayload(bron), {
    secret: "fout",
    fetchImpl: (async () => {
      pogingen++;
      return nepAntwoord(401, { error: "invalid_opdrachten_secret" });
    }) as unknown as typeof fetch,
  });
  assert.equal(pogingen, 1);
  assert.deepEqual(resultaat, { status: "mislukt", reden: "invalid_opdrachten_secret" });
});

test("meldOpdrachtBijDonna probeert het opnieuw als Donna er even uit ligt", async () => {
  let pogingen = 0;
  const resultaat = await meldOpdrachtBijDonna("koolhaas", bouwOpdrachtPayload(bron), {
    secret: "geheim",
    fetchImpl: (async () => {
      pogingen++;
      if (pogingen < 3) throw new Error("network down");
      return nepAntwoord(201, { ok: true });
    }) as unknown as typeof fetch,
  });
  assert.equal(pogingen, 3);
  assert.equal(resultaat.status, "verstuurd");
});

test("meldOpdrachtBijDonna geeft nooit een fout door aan de aanroeper", async () => {
  // Het akkoord van de klant is al verwerkt; dat mag hier niet alsnog stuklopen.
  const resultaat = await meldOpdrachtBijDonna("koolhaas", bouwOpdrachtPayload(bron), {
    secret: "geheim",
    fetchImpl: (async () => {
      throw new Error("kapot");
    }) as unknown as typeof fetch,
  });
  assert.equal(resultaat.status, "mislukt");
});
