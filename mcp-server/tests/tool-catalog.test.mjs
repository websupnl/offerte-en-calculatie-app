import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('complete MCP catalog registers without duplicate tools', async () => {
  const client = new Client({ name: 'catalog-regression', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused', MCP_HTTP_MODE: 'false' },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map(tool => tool.name);
    assert.equal(new Set(names).size, names.length);
    for (const name of ['update_calculation', 'patch_quote', 'preview_quote', 'clone_quote', 'update_project', 'update_project_legacy', 'update_quote_legacy_item', 'update_quote_content_block_legacy', 'get_quote_history', 'restore_quote_version']) {
      assert.ok(names.includes(name), `Missing tool: ${name}`);
    }
    const project = tools.find(tool => tool.name === 'update_project');
    assert.ok(project.inputSchema.properties.fields);
    const calculation = tools.find(tool => tool.name === 'create_quote_calculation');
    assert.ok(calculation.inputSchema.properties.role.enum.includes('OPTION'));
  } finally {
    await client.close();
  }
});
