import assert from "node:assert/strict";
import test from "node:test";
import { startLivenessMonitor } from "./liveness-monitor.mjs";

function harness({ lastRunAt }) {
  const enqueued = [];
  const store = {
    activity: { lastRunAt, lastObservationAt: lastRunAt, lastHeartbeatAt: lastRunAt },
    async localWorkerActivity() { return this.activity; },
    async enqueueTelegramNotification(row) { enqueued.push(row); return { enqueued: true }; },
  };
  return { store, enqueued };
}

// The monitor exposes no manual "tick"; drive it by giving a tiny warmup and
// letting the timer fire, with a fixed clock.
async function runOnce(store, clock) {
  const stop = startLivenessMonitor({ store, now: () => clock, warmupMs: 1, intervalMs: 60_000 });
  await new Promise((r) => setTimeout(r, 15));
  stop();
}

test("a worker that ran a minute ago raises nothing", async () => {
  const clock = new Date("2026-09-07T12:00:00Z");
  const { store, enqueued } = harness({ lastRunAt: new Date("2026-09-07T11:59:00Z") });
  await runOnce(store, clock);
  assert.equal(enqueued.length, 0);
});

test("30 minutes of silence pages Daan once", async () => {
  const clock = new Date("2026-09-07T12:00:00Z");
  const { store, enqueued } = harness({ lastRunAt: new Date("2026-09-07T11:30:00Z") });
  await runOnce(store, clock);
  assert.equal(enqueued.length, 1);
  assert.match(enqueued[0].text, /stil/i);
  assert.match(enqueued[0].dedupeKey, /^whatsapp-liveness-down:/);
});

test("never having run pages Daan", async () => {
  const clock = new Date("2026-09-07T12:00:00Z");
  const { store, enqueued } = harness({ lastRunAt: null });
  await runOnce(store, clock);
  assert.equal(enqueued.length, 1);
  assert.match(enqueued[0].text, /meer dan een week/);
});

test("recovery after a down state sends one all-clear", async () => {
  const store = {
    activity: { lastRunAt: new Date("2026-09-07T11:30:00Z") },
    async localWorkerActivity() { return this.activity; },
    _enq: [],
    async enqueueTelegramNotification(row) { this._enq.push(row); return { enqueued: true }; },
  };
  const stop = startLivenessMonitor({
    store, now: () => store._clock, warmupMs: 1, intervalMs: 5,
  });
  store._clock = new Date("2026-09-07T12:00:00Z"); // down
  await new Promise((r) => setTimeout(r, 20));
  store.activity = { lastRunAt: new Date("2026-09-07T12:00:05Z") };
  store._clock = new Date("2026-09-07T12:00:10Z"); // healthy again
  await new Promise((r) => setTimeout(r, 20));
  stop();
  const kinds = store._enq.map((row) => row.dedupeKey.split(":")[0]);
  assert.ok(kinds.includes("whatsapp-liveness-down"));
  assert.ok(kinds.includes("whatsapp-liveness-recovered"));
});
