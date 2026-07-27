#!/usr/bin/env node
/**
 * AI-relay: laat de (online) app de Claude/Codex CLI op deze laptop gebruiken.
 *
 *   Vercel-app  ──HTTPS──►  vaste tunnel  ──►  deze relay  ──►  claude / codex CLI
 *
 * Waarom: de CLI draait op mijn abonnement, dus geen OpenAI-API-kosten per token.
 * Zolang deze laptop aan staat werkt AI ook vanaf de telefoon.
 *
 * Starten:  npm run ai:relay
 * Env:      AI_RELAY_KEY (verplicht), AI_RELAY_PORT (default 8787), AI_CLI (claude|codex)
 *
 * Beveiliging:
 *  - Bearer-token verplicht op /job, met timing-veilige vergelijking.
 *  - De app stuurt alléén een job-type + data. De systeemprompt staat híer,
 *    dus een gekaapte app-key kan de CLI geen willekeurige opdrachten geven.
 *  - De CLI draait zonder tools (--allowedTools ""), dus puur tekst: hij kan
 *    niets op de schijf lezen of schrijven.
 *  - Prompt gaat als argv naar spawn(), nooit door een shell → geen injectie.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local inlezen zonder extra dependency.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // bestand bestaat niet — prima
  }
}

const PORT = Number(process.env.AI_RELAY_PORT ?? 8787);
const KEY = process.env.AI_RELAY_KEY;
const CLI = process.env.AI_CLI ?? "claude";
const JOB_TIMEOUT_MS = 120_000;
const MAX_CONCURRENT = 2;

if (!KEY || KEY.length < 16) {
  console.error("AI_RELAY_KEY ontbreekt of is te kort (minimaal 16 tekens). Zet 'm in .env.local.");
  process.exit(1);
}

/**
 * De systeemprompts staan bewust hier en niet in de webapp: de app stuurt data,
 * niet wat de AI moet zijn. Nieuwe job? Voeg 'm hier toe.
 */
const JOBS = {
  "quote-text": {
    system: (input) =>
      `${input.systemPrompt ?? "Je schrijft offerteteksten."}\n` +
      `Schrijf in het Nederlands, in de ik-vorm, kort en concreet. ` +
      `Geen bureautaal, geen woorden als ontzorgen, totaaloplossing of toekomstbestendig. ` +
      `Lever alleen de tekst, geen inleiding of uitleg eromheen.`,
    user: (input) => String(input.prompt ?? ""),
  },
  advice: {
    system: (input) =>
      `${input.systemPrompt ?? "Je schrijft technische adviesdocumenten."}\n` +
      `Schrijf in het Nederlands in Markdown, met kopjes en waar relevant berekeningen. ` +
      `Leg altijd uit wáárom je iets adviseert, niet alleen wat.`,
    user: (input) => String(input.prompt ?? ""),
  },
  "summarize-feedback": {
    system: () =>
      `Je vat klantfeedback samen tot één heldere taakomschrijving in het Nederlands. ` +
      `Geef alleen de omschrijving terug, maximaal 2 zinnen, concreet en uitvoerbaar.`,
    user: (input) => String(input.prompt ?? ""),
  },
  "task-from-text": {
    system: () =>
      `Je zet een rommelig briefje of gespreksnotitie om in taken. ` +
      `Geef puur JSON terug: {"tasks":[{"title":"...","dueHint":"...|null"}]}. ` +
      `Geen uitleg, geen markdown-fences.`,
    user: (input) => String(input.prompt ?? ""),
  },
};

let running = 0;

function authorized(req) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

function runCli(system, user) {
  return new Promise((resolve, reject) => {
    const prompt = `${system}\n\n---\n\n${user}`;
    const args =
      CLI === "codex"
        ? ["exec", "--skip-git-repo-check", prompt]
        : ["-p", prompt, "--allowedTools", ""];

    const child = spawn(CLI, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });

    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${CLI} reageerde niet binnen ${JOB_TIMEOUT_MS / 1000}s`));
    }, JOB_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`${CLI} kon niet starten: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `${CLI} stopte met code ${code}`));
      resolve(out.trim());
    });
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if ((url.pathname === "/" || url.pathname === "/health") && req.method === "GET") {
    return json(res, 200, { ok: true, cli: CLI, running, max: MAX_CONCURRENT });
  }

  if (url.pathname !== "/job" || req.method !== "POST") {
    return json(res, 404, { error: "Niet gevonden" });
  }
  if (!authorized(req)) {
    return json(res, 401, { error: "Ongeldige sleutel" });
  }
  if (running >= MAX_CONCURRENT) {
    return json(res, 429, { error: "Relay is bezig, probeer zo opnieuw" });
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 512_000) {
      return json(res, 413, { error: "Verzoek te groot" });
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json(res, 400, { error: "Ongeldige JSON" });
  }

  const job = JOBS[parsed.type];
  if (!job) {
    return json(res, 400, { error: `Onbekend job-type: ${parsed.type}` });
  }

  running += 1;
  const started = Date.now();
  console.log(`[relay] ${parsed.type} gestart`);
  try {
    const text = await runCli(job.system(parsed.input ?? {}), job.user(parsed.input ?? {}));
    console.log(`[relay] ${parsed.type} klaar in ${Math.round((Date.now() - started) / 1000)}s`);
    json(res, 200, { text });
  } catch (error) {
    console.error(`[relay] ${parsed.type} mislukt:`, error.message);
    json(res, 502, { error: error.message });
  } finally {
    running -= 1;
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI-relay luistert op http://127.0.0.1:${PORT} (CLI: ${CLI})`);
  console.log("Publiek bereikbaar via de bestaande named Cloudflare Tunnel.");
});
