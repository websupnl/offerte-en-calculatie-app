import assert from "node:assert/strict";
import {
  applyQuoteDocumentCommand,
  createBlankQuoteDocument,
  legacyQuoteToDocument,
  parseQuoteDocument,
  sanitizeDocumentForTemplate,
  type QuoteDocument,
} from "../src/lib/quote-document";

{
  const document = createBlankQuoteDocument("Testofferte");
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.blocks[0].type, "hero");
  assert.ok(parseQuoteDocument(document));
}

{
  const document = legacyQuoteToDocument({
    title: "Thuisbatterij",
    category: "Energieopslag",
    intro: "Persoonlijke toelichting",
    items: [{ description: "Installatie" }],
    assumptions: ["Meterkast is bereikbaar"],
    exclusions: ["Graafwerk"],
    outro: "Ik hoor graag van u.",
  });
  assert.deepEqual(document.blocks.map((block) => block.type), ["hero", "quoteItems", "list", "list", "signature"]);
}

{
  const original = createBlankQuoteDocument();
  const firstId = original.blocks[0].id;
  const duplicated = applyQuoteDocumentCommand(original, { action: "duplicate", blockId: firstId });
  assert.equal(duplicated.blocks.length, original.blocks.length + 1);
  assert.notEqual(duplicated.blocks[0].id, duplicated.blocks[1].id);

  const moved = applyQuoteDocumentCommand(duplicated, { action: "move", blockId: firstId, index: 2 });
  assert.equal(moved.blocks[2].id, firstId);
}

{
  const withCalculation: QuoteDocument = {
    schemaVersion: 1,
    blocks: [{
      id: "calculation-1",
      type: "calculation",
      title: "16 kWh",
      description: "Compleet systeem",
      showItems: true,
      snapshot: {
        calculationId: "calc-1",
        number: "KI-C001",
        title: "16 kWh",
        syncedAt: new Date().toISOString(),
        totalSalesPrice: 5000,
        vatRate: 21,
        items: [],
      },
    }],
  };
  const template = sanitizeDocumentForTemplate(withCalculation);
  assert.equal(template.blocks.length, 0, "Templates mogen geen klantgebonden calculatiekoppeling bewaren");
}

{
  assert.equal(parseQuoteDocument({ schemaVersion: 99, blocks: [] }), null);
  assert.equal(parseQuoteDocument({ schemaVersion: 1, blocks: [{ id: "x", type: "unknown" }] }), null);
}
