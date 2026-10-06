/**
 * De rol van een calculatie op een offerte. Eén plek voor de waarden en de
 * Nederlandse namen, zodat elk scherm hetzelfde zegt.
 *
 *   BASE     Basis: telt altijd mee in de prijs.
 *   VARIANT  Variant: twee of meer, de klant kiest er één (een tweede optie in
 *            plaats van iets anders).
 *   OPTION   Meerprijs: een hele calculatie die de klant kan aanvinken bovenop
 *            de basis, bijvoorbeeld "thuisbatterij erbij".
 */
export const CALCULATION_ROLES = ["BASE", "VARIANT", "OPTION"] as const;
export type CalculationRole = (typeof CALCULATION_ROLES)[number];

export function asCalculationRole(value: unknown): CalculationRole {
  return value === "VARIANT" || value === "OPTION" ? value : "BASE";
}

export const ROLE_LABEL: Record<CalculationRole, string> = {
  BASE: "Basis",
  VARIANT: "Variant",
  OPTION: "Meerprijs",
};

export const ROLE_EXPLANATION: Record<CalculationRole, string> = {
  BASE: "Telt altijd mee in de prijs",
  VARIANT: "De klant kiest één van de varianten",
  OPTION: "De klant kan dit aanvinken bovenop de basis",
};

export const roleLabel = (value: unknown) => ROLE_LABEL[asCalculationRole(value)];
