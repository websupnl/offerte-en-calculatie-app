export class CalculationLinkError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export function validateCalculationLinks(
  selected: { id: string; role: 'BASE' | 'VARIANT' | 'OPTION' }[],
  calculations: { id: string; quoteId: string | null; customerId: string | null }[],
  quote: { id: string; customerId: string; status: string; items: unknown[] },
  existing: { id: string; role: string }[],
) {
  if (new Set(selected.map(c => c.id)).size !== selected.length) throw new CalculationLinkError('Selecteer elke calculatie één keer.', 400);
  if (calculations.length !== selected.length) throw new CalculationLinkError('Een geselecteerde calculatie bestaat niet of is gearchiveerd.', 404);
  if (quote.status !== 'DRAFT') throw new CalculationLinkError('Calculaties toevoegen kan alleen aan een conceptofferte.');
  if (quote.items.length) throw new CalculationLinkError('Zet eerst de losse offerteregels om naar een calculatie.');
  if (calculations.some(c => c.quoteId && c.quoteId !== quote.id)) throw new CalculationLinkError('Een calculatie hoort al bij een andere offerte. Maak daarvan eerst een losse kopie.');
  if (calculations.some(c => c.customerId && c.customerId !== quote.customerId)) throw new CalculationLinkError('De calculaties en offerte moeten bij dezelfde klant horen.');
  const roles = new Map(existing.map(c => [c.id, c.role]));
  for (const calculation of selected) roles.set(calculation.id, calculation.role);
  if ([...roles.values()].filter(r => r === 'VARIANT').length === 1) throw new CalculationLinkError('Eén variant is geen keuze. Kies minimaal twee varianten, of zet de calculatie op Basis of Meerprijs.', 400);
}
