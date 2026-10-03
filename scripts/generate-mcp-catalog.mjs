import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src/app/api');
const routes = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    if (entry.name !== 'route.ts') continue;
    const source = await readFile(file, 'utf8');
    // Only authenticated app functions, never public token routes or infrastructure.
    if (!source.includes('await auth()')) continue;
    const route = '/api/' + path.relative(root, dir).split(path.sep).join('/');
    if (/^\/api\/(auth|mcp|cli|donna|cron|webhooks|push)(\/|$)/.test(route)
      || route === '/api/company/switch' || /\/integrations\/google\/(connect|callback)$/.test(route)) continue;
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const methods = ast.statements.filter(s => ts.isFunctionDeclaration(s) && s.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
      .map(s => s.name?.text).filter(m => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m));
    if (!methods.length) continue;
    const schemas = ast.statements.filter(s => ts.isVariableStatement(s) && s.getText(ast).includes('z.'))
      .map(s => s.getText(ast)).join('\n');
    const queryParameters = [...source.matchAll(/(?:params|searchParams)\.get\("([^"]+)"\)/g)].map(m => m[1]);
    const formFields = [...source.matchAll(/(?:formData|form)\.get\("([^"]+)"\)/g)].map(m => m[1]);
    const bodyFields = [...source.matchAll(/const\s*\{([^}]+)\}\s*=\s*await\s+\w+\.json\(\)/g)].flatMap(m => m[1].split(',').map(field => field.trim().split(/[:=]/)[0].trim()).filter(Boolean));
    routes.push({ path: route, methods, queryParameters: [...new Set(queryParameters)], formFields: [...new Set(formFields)], bodyFields, schemas });
  }
}
await walk(root);
routes.sort((a, b) => a.path.localeCompare(b.path));
await writeFile('src/lib/mcp-catalog.json', JSON.stringify(routes, null, 2) + '\n');
console.log(`MCP catalog: ${routes.length} authenticated routes`);
