/**
 * AI-laag met twee bronnen:
 *
 *  1. `local-cli` — de Claude/Codex CLI op Daans laptop, via `scripts/ai-relay.mjs`
 *     en een tunnel. Kost niets per token (draait op het abonnement), maar werkt
 *     alleen als die laptop aan staat.
 *  2. `openai`    — de oude weg. Blijft als terugval bestaan; haal je de key uit
 *     Vercel, dan is de app puur local-only.
 *
 * De keuze valt automatisch: relay bereikbaar → relay, anders OpenAI, anders niets.
 */

import { generateText as openaiGenerateText } from "@/lib/openai";

export type AiProvider = "local-cli" | "openai" | "none";

export type AiJobType = "quote-text" | "advice" | "summarize-feedback" | "task-from-text";

export type AiJob = {
  type: AiJobType;
  systemPrompt?: string;
  prompt: string;
  /** Alleen gebruikt als we op OpenAI terugvallen. */
  openaiApiKey?: string;
};

const HEALTH_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 3_000;
const JOB_TIMEOUT_MS = 150_000;

let healthCache: { at: number; online: boolean } | null = null;

function relayUrl(): string | null {
  const url = process.env.AI_RELAY_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Is de relay bereikbaar? Antwoord wordt 30s gecachet, anders tikt elke
 * paginaload de tunnel aan.
 */
export async function isRelayOnline(force = false): Promise<boolean> {
  const url = relayUrl();
  if (!url) return false;
  if (!force && healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.online;
  }

  let online = false;
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    online = response.ok;
  } catch {
    online = false;
  }

  healthCache = { at: Date.now(), online };
  return online;
}

export async function aiStatus(): Promise<{ provider: AiProvider; online: boolean; reason?: string }> {
  if (relayUrl()) {
    const online = await isRelayOnline();
    if (online) return { provider: "local-cli", online: true };
    if (process.env.OPENAI_API_KEY) {
      return { provider: "openai", online: true, reason: "Laptop offline — terugval op OpenAI" };
    }
    return { provider: "local-cli", online: false, reason: "Laptop staat uit" };
  }
  if (process.env.OPENAI_API_KEY) return { provider: "openai", online: true };
  return { provider: "none", online: false, reason: "Geen AI ingesteld" };
}

class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export { AiUnavailableError };

async function runOnRelay(job: AiJob): Promise<string> {
  const url = relayUrl();
  if (!url) throw new AiUnavailableError("Geen relay ingesteld");

  const response = await fetch(`${url}/job`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AI_RELAY_KEY ?? ""}`,
    },
    body: JSON.stringify({
      type: job.type,
      input: { systemPrompt: job.systemPrompt, prompt: job.prompt },
    }),
    signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiUnavailableError(body.error ?? `Relay gaf status ${response.status}`);
  }
  return String(body.text ?? "");
}

/**
 * Voert een AI-job uit. Gooit `AiUnavailableError` als er niets beschikbaar is —
 * de route hoort dat als een nette melding aan de gebruiker te tonen, niet als
 * een harde crash.
 */
export async function aiGenerate(job: AiJob): Promise<{ text: string; provider: AiProvider }> {
  if (relayUrl() && (await isRelayOnline())) {
    try {
      return { text: await runOnRelay(job), provider: "local-cli" };
    } catch (error) {
      // Relay viel om tijdens de job — probeer OpenAI als die er is.
      healthCache = null;
      if (!process.env.OPENAI_API_KEY && !job.openaiApiKey) {
        throw error instanceof AiUnavailableError
          ? error
          : new AiUnavailableError("AI-relay onbereikbaar");
      }
    }
  }

  const key = job.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new AiUnavailableError(
      "AI is nu niet beschikbaar. De laptop met de AI-relay staat uit en er is geen OpenAI-sleutel ingesteld.",
    );
  }

  const text = await openaiGenerateText(job.systemPrompt ?? "", job.prompt, key);
  return { text, provider: "openai" };
}
