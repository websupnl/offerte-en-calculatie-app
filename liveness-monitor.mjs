// The failure mode this connector keeps hitting is silence, not a crash.
//
//   2026-08-08  worker process killed        -- noticed after 3 days
//   2026-09-05  chat-list selectors rotted   -- worker ran, extracted nothing,
//                                               logged only errors, no one looked
//
// The worker posts a heartbeat every 5 minutes and a run row for every message
// it forwards. This watches the freshest of those and pings Daan on Telegram
// when the stream goes quiet, then once more every few hours until it is back.
// It deliberately does NOT alert on "quiet day, no messages" -- a silent
// Saturday is not a fault.

import { createHash } from "node:crypto";

const MINUTE = 60_000;
const sha12 = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

function fmt(date) {
  if (!date) return "onbekend";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short", timeStyle: "short", timeZone: "Europe/Amsterdam",
  }).format(date);
}

function describeAge(ms) {
  if (!Number.isFinite(ms)) return "meer dan een week";
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} uur`;
  return `${Math.round(hours / 24)} dagen`;
}

// One bucket per `reAlertMs` window, so a still-down worker nags again on its
// own schedule instead of once and then never.
const bucketOf = (date, windowMs) => Math.floor(date.getTime() / windowMs);

export function startLivenessMonitor({
  store,
  onLog = () => {},
  now = () => new Date(),
  intervalMs = 5 * MINUTE,
  downAfterMs = 25 * MINUTE,
  reAlertMs = 6 * 60 * MINUTE,
  warmupMs = 6 * MINUTE,
}) {
  let state = "unknown"; // "healthy" | "down"
  let alertedBucket = null;
  let stopped = false;
  let running = false;

  async function check() {
    if (stopped || running) return;
    running = true;
    try {
      const activity = await store.localWorkerActivity();
      const current = now();
      const lastRun = activity.lastRunAt;
      const ageMs = lastRun ? current.getTime() - lastRun.getTime() : Infinity;
      const isDown = ageMs > downAfterMs;

      if (isDown) {
        const bucket = bucketOf(current, reAlertMs);
        if (state !== "down" || alertedBucket !== bucket) {
          const text = [
            "⚠️ WhatsApp-observatie is stil.",
            "",
            `Laatste teken van leven: ${describeAge(ageMs)} geleden (${fmt(lastRun)}).`,
            "De worker op de gamePC draait niet, of kan de ingress niet bereiken.",
            'Check de scheduled task "Emma WhatsApp Worker" en of WhatsApp Web nog is ingelogd.',
          ].join("\n");
          const result = await store.enqueueTelegramNotification({
            notificationId: `notification:whatsapp-liveness-${sha12(`down:${bucket}`)}`,
            dedupeKey: `whatsapp-liveness-down:${bucket}`,
            text,
          });
          onLog({ event: "alert_enqueued", kind: "down", ageSeconds: Math.round(ageMs / 1000), enqueued: result.enqueued });
        }
        state = "down";
        alertedBucket = bucket;
      } else {
        if (state === "down") {
          const result = await store.enqueueTelegramNotification({
            notificationId: `notification:whatsapp-liveness-${sha12(`ok:${current.toISOString().slice(0, 13)}`)}`,
            dedupeKey: `whatsapp-liveness-recovered:${current.toISOString().slice(0, 13)}`,
            text: `✅ WhatsApp-observatie draait weer. Laatste bericht verwerkt of heartbeat om ${fmt(lastRun)}.`,
          });
          onLog({ event: "alert_enqueued", kind: "recovered", enqueued: result.enqueued });
        } else {
          onLog({
            event: "checked",
            state: "healthy",
            lastRunAt: lastRun ? lastRun.toISOString() : null,
            lastObservationAt: activity.lastObservationAt ? activity.lastObservationAt.toISOString() : null,
          });
        }
        state = "healthy";
        alertedBucket = null;
      }
    } catch (error) {
      onLog({ event: "check_failed", error: String(error?.message ?? error).slice(0, 160) });
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void check(), intervalMs);
  timer.unref?.();
  // A fresh deploy has no recent runs yet; wait before the first check so the
  // ingress does not page Daan about its own restart.
  const warmup = setTimeout(() => void check(), warmupMs);
  warmup.unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(warmup);
  };
}
