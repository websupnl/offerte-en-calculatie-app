/**
 * Herhalende taken. Bewust een kleine subset van RRULE — genoeg voor
 * "jaarlijkse keuring", "elke maand factureren", "elke week nabellen", en
 * niet meer dan dat.
 *
 * Formaat: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY;INTERVAL=n
 */

export type Recurrence = { freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"; interval: number };

export const RECUR_PRESETS: { label: string; rule: string | null }[] = [
  { label: "Niet herhalen", rule: null },
  { label: "Elke dag", rule: "FREQ=DAILY;INTERVAL=1" },
  { label: "Elke week", rule: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "Elke 2 weken", rule: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Elke maand", rule: "FREQ=MONTHLY;INTERVAL=1" },
  { label: "Elk kwartaal", rule: "FREQ=MONTHLY;INTERVAL=3" },
  { label: "Elk jaar", rule: "FREQ=YEARLY;INTERVAL=1" },
];

export function parseRecurRule(rule: string | null | undefined): Recurrence | null {
  if (!rule) return null;
  const parts = Object.fromEntries(
    rule
      .split(";")
      .map((part) => part.split("="))
      .filter((pair) => pair.length === 2)
      .map(([key, value]) => [key.toUpperCase(), value.toUpperCase()]),
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const interval = Number(parts.INTERVAL ?? 1);
  return { freq, interval: Number.isFinite(interval) && interval > 0 ? Math.min(interval, 99) : 1 };
}

export function describeRecurRule(rule: string | null | undefined): string {
  const preset = RECUR_PRESETS.find((item) => item.rule === rule);
  if (preset) return preset.label;
  const parsed = parseRecurRule(rule);
  if (!parsed) return "Niet herhalen";
  const unit = { DAILY: "dag", WEEKLY: "week", MONTHLY: "maand", YEARLY: "jaar" }[parsed.freq];
  return parsed.interval === 1 ? `Elke ${unit}` : `Elke ${parsed.interval} ${unit}${unit === "maand" ? "en" : "en"}`;
}

/**
 * Volgende datum na `from`. Telt vanaf de geplande datum, niet vanaf vandaag —
 * anders schuift een jaarlijkse keuring elk jaar op omdat je 'm te laat afvinkt.
 */
export function nextOccurrence(from: Date, rule: string): Date | null {
  const parsed = parseRecurRule(rule);
  if (!parsed) return null;

  const next = new Date(from);
  switch (parsed.freq) {
    case "DAILY":
      next.setDate(next.getDate() + parsed.interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * parsed.interval);
      break;
    case "MONTHLY": {
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + parsed.interval);
      // 31 januari + 1 maand = 28/29 februari, niet 3 maart.
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      break;
    }
    case "YEARLY": {
      const day = next.getDate();
      const month = next.getMonth();
      next.setDate(1);
      next.setFullYear(next.getFullYear() + parsed.interval, month);
      const lastDay = new Date(next.getFullYear(), month + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      break;
    }
  }
  return next;
}
