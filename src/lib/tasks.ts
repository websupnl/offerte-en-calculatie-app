/**
 * Werkplek: scope-regels, labels en quick-add.
 *
 * Scope-regel (belangrijk): een privé-item heeft `companyId = null` en hangt
 * alleen aan `ownerId`. Een zakelijk item heeft altijd een `companyId`.
 * Gebruik ALTIJD `scopeWhere()` in queries — dan kan privéwerk niet in een
 * zakelijk overzicht opduiken en andersom, ook niet na het wisselen van bedrijf.
 */

export type Scope = "business" | "private";

export const TASK_STATUSES = ["OPEN", "DOING", "WAITING", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  DOING: "Mee bezig",
  WAITING: "Wacht op ander",
  DONE: "Klaar",
  CANCELLED: "Vervallen",
};

export const TASK_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "outline",
  DOING: "default",
  WAITING: "secondary",
  DONE: "secondary",
  CANCELLED: "secondary",
};

/** Statussen die nog aandacht nodig hebben. */
export const ACTIVE_TASK_STATUSES = ["OPEN", "DOING", "WAITING"] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  0: "Normaal",
  1: "Hoog",
  2: "Urgent",
};

export const TASK_LIST_KINDS = ["LIST", "SHOPPING", "BOARD"] as const;

export const TASK_LIST_KIND_LABELS: Record<string, string> = {
  LIST: "Lijst",
  SHOPPING: "Boodschappen",
  BOARD: "Bord",
};

/**
 * Where-fragment voor de gekozen scope.
 * - business → alleen items van het actieve bedrijf
 * - private  → alleen eigen items zonder bedrijf
 */
export function scopeWhere(
  scope: Scope,
  { userId, companyId }: { userId: string; companyId?: string | null },
): { companyId: string } | { companyId: null; ownerId: string } {
  if (scope === "private") {
    return { companyId: null, ownerId: userId };
  }
  if (!companyId) {
    // Geen actief bedrijf: liever niets tonen dan per ongeluk privéwerk.
    throw new Error("Geen actief bedrijf voor zakelijke scope");
  }
  return { companyId };
}

/** Velden die bij het aanmaken de scope vastleggen. */
export function scopeData(
  scope: Scope,
  { userId, companyId }: { userId: string; companyId?: string | null },
): { companyId: string | null; ownerId: string } {
  if (scope === "private") return { companyId: null, ownerId: userId };
  if (!companyId) throw new Error("Geen actief bedrijf voor zakelijke scope");
  return { companyId, ownerId: userId };
}

export function parseScope(value: string | null | undefined): Scope {
  return value === "private" ? "private" : "business";
}

// ─── Quick-add ──────────────────────────────────────────────────────────────

export type QuickAddResult = {
  title: string;
  dueAt: Date | null;
  startAt: Date | null;
  allDay: boolean;
  priority: number;
};

const WEEKDAYS: Record<string, number> = {
  zondag: 0,
  maandag: 1,
  dinsdag: 2,
  woensdag: 3,
  donderdag: 4,
  vrijdag: 5,
  zaterdag: 6,
};

const MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
};

function atTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function startOfDay(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Haalt datum, tijd en prioriteit uit gewone Nederlandse invoer.
 *
 *   "morgen 10:00 Arjan bellen"     → morgen 10:00, titel "Arjan bellen"
 *   "vrijdag offerte nabellen !"    → eerstvolgende vrijdag, prioriteit hoog
 *   "12 maart keuring inplannen"    → 12 maart
 *   "boodschappen doen"             → geen datum
 *
 * Bewust simpel gehouden: wat niet herkend wordt blijft gewoon in de titel
 * staan. Liever een taak met een rare titel dan een taak op de verkeerde dag.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult {
  let text = ` ${input.trim()} `;
  let day: Date | null = null;
  let time: { h: number; m: number } | null = null;
  let priority = 0;

  const cut = (pattern: RegExp) => {
    const match = text.match(pattern);
    if (match) text = text.replace(match[0], " ");
    return match;
  };

  // Prioriteit: !! = urgent, ! = hoog
  if (cut(/\s!!(?=\s)/)) priority = 2;
  else if (cut(/\s!(?=\s)/)) priority = 1;

  // Tijd: "10:00", "10.00", "om 10 uur", "10u"
  const timeMatch = cut(/\s(?:om\s+)?(\d{1,2})[:.u](\d{2})(?=\s)/i) ?? cut(/\s(?:om\s+)?(\d{1,2})\s*uur(?=\s)/i);
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) time = { h, m };
  }

  // Relatieve dagen
  if (cut(/\svandaag(?=\s)/i)) {
    day = startOfDay(now);
  } else if (cut(/\smorgen(?=\s)/i)) {
    day = startOfDay(new Date(now.getTime() + 86400000));
  } else if (cut(/\sovermorgen(?=\s)/i)) {
    day = startOfDay(new Date(now.getTime() + 2 * 86400000));
  } else {
    // "volgende week maandag" / "maandag"
    const nextWeek = cut(/\svolgende\s+week(?=\s)/i);
    const weekdayMatch = cut(new RegExp(`\\s(${Object.keys(WEEKDAYS).join("|")})(?=\\s)`, "i"));
    if (weekdayMatch || nextWeek) {
      const d = startOfDay(now);
      if (nextWeek) {
        // "volgende week ..." rekent vanaf de maandag van de vólgende
        // kalenderweek — niet simpelweg +7 dagen, want dan zou "volgende week
        // maandag" op een woensdag twee weken vooruit springen.
        const daysToNextMonday = (1 - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + daysToNextMonday);
        if (weekdayMatch) {
          const target = WEEKDAYS[weekdayMatch[1].toLowerCase()];
          d.setDate(d.getDate() + ((target - 1 + 7) % 7)); // maandag = 0 ... zondag = 6
        }
      } else {
        const target = WEEKDAYS[weekdayMatch![1].toLowerCase()];
        let delta = (target - d.getDay() + 7) % 7;
        if (delta === 0) delta = 7; // kaal "maandag" op een maandag = volgende maandag
        d.setDate(d.getDate() + delta);
      }
      day = d;
    } else {
      // "12 maart" of "12-03" / "12-03-2026"
      const monthMatch = cut(new RegExp(`\\s(\\d{1,2})\\s+(${Object.keys(MONTHS).join("|")})(?=\\s)`, "i"));
      if (monthMatch) {
        const d = startOfDay(now);
        d.setMonth(MONTHS[monthMatch[2].toLowerCase()], Number(monthMatch[1]));
        if (d < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
        day = d;
      } else {
        const numericMatch = cut(/\s(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?(?=\s)/);
        if (numericMatch) {
          const d = startOfDay(now);
          const year = numericMatch[3]
            ? Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3])
            : d.getFullYear();
          d.setFullYear(year, Number(numericMatch[2]) - 1, Number(numericMatch[1]));
          if (!numericMatch[3] && d < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
          day = d;
        }
      }
    }
  }

  // Alleen een tijd zonder dag → vandaag, of morgen als het al geweest is.
  if (!day && time) {
    const candidate = atTime(now, time.h, time.m);
    day = startOfDay(candidate < now ? new Date(now.getTime() + 86400000) : now);
  }

  const title = text.replace(/\s+/g, " ").trim();
  const when = day && time ? atTime(day, time.h, time.m) : day;

  return {
    title: title || input.trim(),
    dueAt: when,
    startAt: time && when ? when : null,
    allDay: Boolean(day) && !time,
    priority,
  };
}
