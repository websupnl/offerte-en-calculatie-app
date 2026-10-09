import assert from "node:assert/strict";
import test from "node:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTools } from "../mcp-server/src/app-tools";

test("gerichte MCP-acties gebruiken de veilige app-paden en preview levert afbeeldingen", async () => {
  const handlers = new Map<string, (input: Record<string, unknown>) => Promise<{ isError?: boolean; content: { type: string; text?: string; data?: string }[] }>>();
  const schemas = new Map<string, Record<string, unknown>>();
  const fakeServer = { registerTool(name: string, config: { inputSchema: Record<string, unknown> }, handler: (input: Record<string, unknown>) => Promise<never>) {
    assert.ok(!handlers.has(name), `Dubbele tool ${name}`);
    schemas.set(name, config.inputSchema); handlers.set(name, handler);
  } } as unknown as McpServer;
  registerAppTools(fakeServer, { quoteCompany: async () => "koolhaas", calculationId: async () => "resolved-c026" });
  for (const name of ["update_calculation", "update_project", "delete_project", "patch_quote", "update_quote_option", "update_quote_content_block", "delete_quote_content_block", "preview_quote", "update_quote_item", "reorder_quote_sections", "add_quote_image", "validate_quote", "clone_quote", "get_quote_history", "restore_quote_version"]) assert.ok(handlers.has(name), name);
  assert.deepEqual(Object.keys(schemas.get("update_calculation")!).sort(), ["calculation_id", "company_slug", "description", "title"]);
  const fetchBefore = globalThis.fetch;
  const keyBefore = process.env.MCP_APP_KEY;
  process.env.MCP_APP_KEY = "test-key";
  const calls: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url, init) => {
    const input = JSON.parse(String(init?.body)); calls.push(input);
    return new Response(JSON.stringify({ status: 200, data: String(input.path).endsWith("/preview") ? { images: ["png-test"], pageCount: 7, overflow: [] } : { ok: true } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await handlers.get("update_calculation")!({ company_slug: "koolhaas", calculation_id: "KI-2026-C026", description: "Nieuwe uitleg" });
    assert.equal(calls[0].path, "/api/calculations/resolved-c026");
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].body, { description: "Nieuwe uitleg" });
    await handlers.get("update_quote_option")!({ quote_id: "q", option_id: "c026", changes: { title: "Meerwerk" } });
    assert.deepEqual(calls[1].body, { option: { id: "c026", changes: { title: "Meerwerk" } } });
    const preview = await handlers.get("preview_quote")!({ quote_id: "q", start_page: 4, limit: 3 });
    assert.deepEqual(calls[2].query, { startPage: 4, limit: 3 });
    assert.equal(preview.content[1].type, "image");
    assert.equal(preview.content[1].data, "png-test");
    assert.ok(!preview.content[0].text?.includes("png-test"));
    const invalid = await handlers.get("update_calculation")!({ company_slug: "koolhaas", calculation_id: "c026" });
    assert.equal(invalid.isError, true);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.MCP_APP_KEY; else process.env.MCP_APP_KEY = keyBefore;
  }
});
