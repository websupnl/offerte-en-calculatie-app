// Manual integration test. Creates isolated fixtures and removes them in finally.
// Requires .env.local with DATABASE_URL. Never sends mail or payment requests.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { encode } from 'next-auth/jwt';
import { chromium } from 'playwright-core';
import { Client } from '../mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

dotenv.config({ path: '.env.local', quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const key = randomBytes(32).toString('hex');
const origin = 'http://localhost:3001';
const marker = `MCP-smoke-${Date.now()}`;
let customerId;
let server;
let client;
let browser;
try {
  const { rows: users } = await pool.query('SELECT id, name, email, role FROM "User" WHERE email=$1', ['info@websup.nl']);
  assert.equal(users.length, 1, 'Configured test user must exist');
  const user = users[0];
  const { rows: memberships } = await pool.query('SELECT co.id, co.name, co.slug, cu.role FROM "CompanyUser" cu JOIN "Company" co ON co.id=cu."companyId" WHERE cu."userId"=$1', [user.id]);
  assert.ok(memberships.length);
  const company = memberships.find(c => c.slug === 'websup') || memberships[0];
  const env = { ...process.env, MCP_APP_KEY: key, MCP_USER_ID: user.id, APP_URL: origin, AUTH_URL: origin, NEXTAUTH_URL: origin, MCP_INTERNAL_APP_URL: origin, AUTH_TRUST_HOST: 'true' };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3001'], { env, stdio: 'ignore', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { const response = await fetch(`${origin}/api/mcp`); if (response.status === 401) { ready = true; break; } } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready, 'Local app must start on 3001');
  const unauthorized = await fetch(`${origin}/api/mcp`, { headers: { authorization: 'Bearer invalid' } });
  assert.equal(unauthorized.status, 401);
  client = new Client({ name: 'mcp-smoke', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp-server/build/index.js'], env: { ...env, MCP_HTTP_MODE: 'false' }, stderr: 'pipe' }));
  const { tools } = await client.listTools();
  assert.ok(tools.some(t => t.name === 'link_calculations_to_quote'));
  async function tool(name, args) {
    const response = await client.callTool({ name, arguments: args });
    assert.equal(response.isError, undefined, `${name}: ${JSON.stringify(response.content)}`);
    return JSON.parse(response.content[0].text);
  }
  async function read(apiPath) { return (await tool('app_read', { company_slug: company.slug, path: apiPath })).data; }
  async function write(apiPath, body) { return (await tool('app_write', { company_slug: company.slug, path: apiPath, method: 'POST', body })).data; }
  const capabilities = await tool('get_app_capabilities', { filter: 'calculations' });
  assert.ok(capabilities.routes.some(r => r.path === '/api/calculations/link-to-quote'));
  const customer = await write('/api/customers', { name: marker });
  customerId = customer.id;
  const a = await write('/api/calculations', { title: `${marker} A`, customerId, items: [{ description: 'Test basis A', qty: 1, costPrice: 20, unitPrice: 100, vatRate: 21 }] });
  const b = await write('/api/calculations', { title: `${marker} B`, customerId, items: [{ description: 'Test basis B', qty: 1, costPrice: 30, unitPrice: 200, vatRate: 21 }] });
  const sourceSnapshot = calculation => ({
    title: calculation.title, description: calculation.description, customerId: calculation.customerId,
    projectId: calculation.projectId, status: calculation.status, notes: calculation.notes,
    totalCostPrice: calculation.totalCostPrice, totalSalesPrice: calculation.totalSalesPrice,
    marginAmount: calculation.marginAmount, marginPercent: calculation.marginPercent,
    items: calculation.items,
  });
  const originalA = sourceSnapshot(await tool('get_calculation', { calculation_id: a.number }));
  const originalB = sourceSnapshot(await tool('get_calculation', { calculation_id: b.number }));

  // Real UI interaction, screenshots of the new dialog at two viewport sizes.
  browser = await chromium.launch({ headless: true, executablePath: process.env.SMOKE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const cookieName = 'authjs.session-token';
  const token = await encode({ secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, salt: cookieName, maxAge: 300,
    token: { sub: user.id, id: user.id, name: user.name, email: user.email, role: user.role, activeCompanyId: company.id, companies: memberships } });
  await context.addCookies([{ name: cookieName, value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  await page.goto(`${origin}/calculations`);
  await page.waitForLoadState('networkidle');
  assert.ok(page.url().endsWith('/calculations'), 'Authenticated UI must open');
  await page.getByPlaceholder('Zoek op titel, nummer, klant of project...').fill(marker);
  await page.getByRole('checkbox', { name: `Selecteer ${a.number}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Selecteer ${b.number}`, exact: true }).check();
  await page.getByRole('button', { name: 'Toevoegen aan offerte', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await dialog.locator('select[id^="role-"]').count(), 2);
  await mkdir('output/mcp-smoke', { recursive: true });
  await page.screenshot({ path: 'output/mcp-smoke/desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/mcp-smoke/mobile.png', animations: 'disabled' });
  const bounds = await dialog.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'Dialog must fit mobile width');
  // Submit the user's exact workflow through the UI.
  await dialog.getByRole('button', { name: 'Toevoegen aan offerte', exact: true }).click();
  await page.waitForURL(/\/quotes\/[^/]+$/);
  const quoteId = page.url().split('/').at(-1);
  let quote = await read(`/api/quotes/${quoteId}`);
  assert.equal(quote.calculations.length, 2);
  assert.equal(Number(quote.totalExVat), 300);
  assert.equal(quote.usesCalculations, true);
  const detailedQuote = await tool('get_quote', { quote_id: quoteId });
  assert.equal(detailedQuote.calculations.length, 2);
  assert.equal(detailedQuote.usesCalculations, true);
  // Exact acceptance: link A, then link B, then read both actual source records.
  await tool('unlink_calculation_from_quote', { quote_id: quoteId, calculation_id: a.number });
  await tool('unlink_calculation_from_quote', { quote_id: quoteId, calculation_id: b.number });
  assert.equal(Number((await read(`/api/quotes/${quoteId}`)).totalExVat), 0);
  const repeatedUnlink = await tool('unlink_calculation_from_quote', { quote_id: quoteId, calculation_id: b.number });
  assert.equal(repeatedUnlink.data.affected, 0);
  await tool('link_calculation_to_quote', { calculation_id: a.id, quote_id: quoteId });
  await tool('link_calculation_to_quote', { calculation_id: b.number, quote_id: quoteId, copy_items: false, mode: 'append' });
  quote = await read(`/api/quotes/${quoteId}`);
  assert.equal(quote.calculations.length, 2, 'Legacy tool must preserve other links');
  const acceptanceQuote = await tool('get_quote', { quote_id: quoteId });
  for (const key of ['calculations', 'calculaties']) assert.deepEqual(new Set(acceptanceQuote[key].map(c => c.number)), new Set([a.number, b.number]));
  for (const [calculation, snapshot] of [[a, originalA], [b, originalB]]) {
    const actual = await tool('get_calculation', { calculation_id: calculation.number });
    assert.equal(actual.quoteId, quoteId);
    assert.deepEqual(sourceSnapshot(actual), snapshot, 'Linking must retain source contents and totals');
  }
  await tool('link_calculations_to_quote', { quote_id: quoteId, calculation_ids: [a.number, b.number], copy_items: false });
  assert.equal((await read(`/api/quotes/${quoteId}`)).calculations.length, 2, 'Repeated multi-link must not duplicate sources');
  const rejectedCopy = await client.callTool({ name: 'link_calculations_to_quote', arguments: { quote_id: quoteId, calculation_ids: [a.number, b.number], copy_items: true } });
  assert.equal(rejectedCopy.isError, true);
  await tool('link_calculations_to_quote', { quote_id: quoteId, mode: 'alternatives', calculation_ids: [a.number, b.number], recommended_calculation_id: a.number });
  let alternatives = await read(`/api/quotes/${quoteId}`);
  assert.equal(alternatives.pricing.variants[0].id, a.id);
  assert.equal(Number(alternatives.totalExVat), 100);
  await tool('link_calculations_to_quote', { quote_id: quoteId, calculations: [{ id: a.id, role: 'VARIANT', sort_order: 1 }, { id: b.id, role: 'VARIANT', sort_order: 0 }], recommended_calculation_id: b.id });
  quote = await read(`/api/quotes/${quoteId}`);
  assert.equal(quote.pricing.variants.length, 2);
  assert.equal(quote.pricing.variants[0].id, b.id);
  for (const [calculation, snapshot] of [[a, originalA], [b, originalB]]) assert.deepEqual(sourceSnapshot(await tool('get_calculation', { calculation_id: calculation.number })), snapshot, 'Relational metadata must not reprice sources');
  const firstVariant = quote.pricing.variants[0];
  const variantTotal = Number(firstVariant.totalExVat);
  assert.equal(Number(quote.totalExVat), variantTotal, 'Use the first alternative rather than adding both');
  assert.ok(variantTotal < 300, 'Alternatives must not be added together');
  await tool('add_calculation_items', { calculation_id: firstVariant.id, items: [{ description: 'Test wijziging', qty: 1, cost_price: 0, unit_price: 25 }] });
  quote = await read(`/api/quotes/${quoteId}`);
  assert.equal(Number(quote.totalExVat), variantTotal + 25, 'Editing a variant must update quote totals');
  console.log(JSON.stringify({ passed: true, tools: tools.length, apiRoutes: capabilities.routes.length, ui: 'desktop + mobile + two selected calculations submitted', basisTotal: 300, variantTotalAfterEdit: variantTotal + 25, screenshots: path.resolve('output/mcp-smoke') }));
} finally {
  await browser?.close();
  await client?.close();
  server?.kill();
  if (customerId) {
    await pool.query('DELETE FROM "Calculation" WHERE "customerId"=$1', [customerId]);
    await pool.query('DELETE FROM "Quote" WHERE "customerId"=$1', [customerId]);
    await pool.query('DELETE FROM "Project" WHERE "customerId"=$1', [customerId]);
    await pool.query('DELETE FROM "Customer" WHERE id=$1', [customerId]);
  }
  await pool.end();
}
