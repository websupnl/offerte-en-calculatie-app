const LONG_DASH_PATTERN = /[\u2012\u2013\u2014\u2015]/g;
const MIDDLE_DOT_SEPARATOR_PATTERN = /\s*[\u00B7\u2022]\s*/g;
const REPEATED_SPACE_PATTERN = /[ \t]{2,}/g;

export const KOOLHAAS_FORBIDDEN_QUOTE_PHRASES = [
  "premiumoplossing",
  "premiumsysteem",
  "budgetkeuze",
  "sterkste totaaloplossing",
  "bewezen oplossing",
  "krachtige energiesturing",
  "toekomstbestendig",
  "naadloze integratie",
] as const;

export function normalizeQuoteCopyText(value: string): string {
  return value
    .replace(LONG_DASH_PATTERN, " - ")
    .replace(MIDDLE_DOT_SEPARATOR_PATTERN, ", ")
    .replace(REPEATED_SPACE_PATTERN, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

export function normalizeQuoteCopyValue<T>(value: T): T {
  if (typeof value === "string") return normalizeQuoteCopyText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeQuoteCopyValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeQuoteCopyValue(item),
      ]),
    ) as T;
  }
  return value;
}

export function findQuoteCopyViolations(value: unknown): string[] {
  const serialized = JSON.stringify(value);
  if (!serialized) return [];

  const violations: string[] = [];
  if (/[\u2012\u2013\u2014\u2015]/.test(serialized)) {
    violations.push("Gebruik gewone koppeltekens in plaats van lange streeptekens.");
  }
  if (/[\u00B7\u2022]/.test(serialized)) {
    violations.push("Gebruik komma's in plaats van middelpunttekens.");
  }
  return violations;
}

export function findForbiddenKoolhaasPhrases(value: unknown): string[] {
  const serialized = JSON.stringify(value)?.toLowerCase() ?? "";
  return KOOLHAAS_FORBIDDEN_QUOTE_PHRASES.filter((phrase) => serialized.includes(phrase));
}
