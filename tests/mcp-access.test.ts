import assert from 'node:assert/strict';
import test from 'node:test';
import { validMcpKey, matchMcpRoute } from '../src/lib/mcp-access';
import catalog from '../src/lib/mcp-catalog.json';

test('MCP toegang faalt dicht zonder sleutel en bij een onjuist bearer-token', () => {
  assert.equal(validMcpKey('Bearer secret', undefined), false);
  assert.equal(validMcpKey(null, 'secret'), false);
  assert.equal(validMcpKey('Bearer secrex', 'secret'), false);
  assert.equal(validMcpKey('secret', 'secret'), false);
  assert.equal(validMcpKey('Bearer secret', 'secret'), true);
});

test('MCP staat alleen bekende app-paden en methodes toe', () => {
  assert.ok(matchMcpRoute('/api/tasks/task-123', 'PATCH', catalog));
  assert.ok(matchMcpRoute('/api/calculations/link-to-quote', 'POST', catalog));
  for (const path of ['/api/auth/session', '/api/mcp', '/api/cli/import-quote', 'https://evil.test/api/tasks', '//evil.test/api/tasks', '/api/tasks/../auth', '/api/tasks/%2e%2e', '/api/tasks?scope=private', '/api//tasks']) {
    assert.equal(matchMcpRoute(path, 'GET', catalog), null, path);
  }
  assert.equal(matchMcpRoute('/api/tasks', 'DELETE', catalog), null);
});

test('de MCP bevat de nieuwe werkplekfuncties en offertehandelingen', () => {
  for (const route of ['/api/tasks', '/api/task-lists', '/api/notes', '/api/contracts', '/api/subscriptions', '/api/portal-access', '/api/projects/[id]/review-boards', '/api/calculations/link-to-quote', '/api/quotes/[id]/send-email', '/api/invoices/[id]/payment-link']) {
    assert.ok(catalog.some(r => r.path === route), route);
  }
});
