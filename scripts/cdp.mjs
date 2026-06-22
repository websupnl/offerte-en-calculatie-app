/**
 * Lichtgewicht CDP (Chrome DevTools Protocol) helper.
 * Verbindt met een bestaande Brave/Chrome instantie op --remote-debugging-port.
 *
 * Gebruik:
 *   const tab = await getActiveTab();
 *   await navigateTab(tab.ws, 'https://example.com');
 *   const text = await getTabText(tab.ws);
 *   tab.ws.close();
 */

import WebSocket from '../node_modules/ws/lib/websocket.js';

const DEFAULT_PORT = 9222;

/** Haal alle open tabs op. */
export async function listTabs(port = DEFAULT_PORT) {
  const res = await fetch(`http://localhost:${port}/json/list`);
  if (!res.ok) throw new Error(`CDP niet bereikbaar op poort ${port}. Start Brave met --remote-debugging-port=${port}`);
  return res.json();
}

/** Geeft de eerste niet-extension tab terug, inclusief een open WebSocket. */
export async function getActiveTab(port = DEFAULT_PORT) {
  const tabs = await listTabs(port);
  const tab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension'));
  if (!tab) throw new Error('Geen geschikte tab gevonden. Open een tabblad in Brave.');
  const ws = await openWs(tab.webSocketDebuggerUrl);
  return { ...tab, ws };
}

/** Open een WebSocket naar een specifieke tab-URL. */
export async function openWs(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return ws;
}

let _msgId = 1;

/** Stuur een CDP-commando en wacht op het antwoord. */
export function send(ws, method, params = {}) {
  const id = _msgId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15_000);
    const listener = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) {
        ws.off('message', listener);
        clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.on('message', listener);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/** Navigeer tab naar een URL en wacht tot de pagina geladen is. */
export async function navigateTab(ws, url, waitMs = 2500) {
  await send(ws, 'Page.enable');
  await send(ws, 'Page.navigate', { url });
  await new Promise(r => setTimeout(r, waitMs));
}

/** Voer JavaScript uit in de tab en geef de return-waarde terug. */
export async function evalTab(ws, expression) {
  const result = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true });
  return result?.result?.value;
}

/** Haal de volledige tekst van de pagina op (document.body.innerText). */
export async function getTabText(ws) {
  return evalTab(ws, 'document.body.innerText');
}

/** Sluit de WebSocket netjes. */
export function closeTab(ws) {
  ws.close();
}
