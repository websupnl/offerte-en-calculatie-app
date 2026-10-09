type CheckQuote = {
  title?: string | null;
  customer?: { name?: string | null } | null;
  items: { id?: string; description: string; qty: unknown; unitPrice: unknown }[];
  options: { id: string; t: string; d: string; price?: number | null; details?: string[] }[];
  contentBlocks?: { id: string; type: string; body?: string | null; imageUrl?: string | null }[];
  calculations?: { id: string; role?: string; customerId?: string | null; quoteId?: string | null; companyId?: string }[];
  id: string;
  companyId?: string;
  customerId?: string;
};
export function validateQuotePresentation(quote: CheckQuote) {
  const issues: { severity: "error" | "warning"; code: string; message: string; id?: string }[] = [];
  const add = (severity: "error" | "warning", code: string, message: string, id?: string) => issues.push({ severity, code, message, id });
  if (!quote.title?.trim()) add("warning", "missing-title", "Een projecttitel ontbreekt");
  if (!quote.customer?.name?.trim()) add("error", "missing-customer", "Klantnaam ontbreekt");
  const seen = new Set<string>();
  for (const item of quote.items) {
    const signature = `${item.description.trim().toLowerCase()}|${Number(item.qty)}|${Number(item.unitPrice)}`;
    if (seen.has(signature)) add("warning", "duplicate-item", "Deze omschrijving, hoeveelheid en prijs komen meermaals voor. Controleer of dit bedoeld is.", item.id);
    seen.add(signature);
  }
  for (const option of quote.options) {
    if (!option.t.trim() || !option.d.trim()) add("error", "missing-option-copy", "Titel of beschrijving van optioneel meerwerk ontbreekt", option.id);
    if (quote.items.some((item) => item.description.trim().toLowerCase() === option.t.trim().toLowerCase() && Number(item.qty) * Number(item.unitPrice) === option.price)) add("warning", "possible-double-price", "Dit meerwerk lijkt ook in de basis te staan. Controleer op dubbele bedragen.", option.id);
  }
  for (const block of quote.contentBlocks ?? []) {
    if (block.type === "image" && !block.imageUrl) add("error", "missing-image", "Een afbeeldingblok heeft geen afbeelding", block.id);
  }
  const calculations = quote.calculations ?? [];
  if (calculations.filter((row) => row.role === "VARIANT").length === 1) add("warning", "single-variant", "Eén variant telt als basis. Gebruik Meerprijs of voeg een tweede variant toe.");
  for (const calc of calculations) {
    if (calc.quoteId !== quote.id || (calc.companyId && calc.companyId !== quote.companyId) || (calc.customerId && calc.customerId !== quote.customerId)) add("error", "invalid-link", "Calculatie en offerte hebben een afwijkende koppeling, klant of bedrijf", calc.id);
  }
  return { valid: !issues.some((issue) => issue.severity === "error"), issues,
    limits: "Duplicaten zijn signalen. Technische claims en tegenstrijdige commerciële tekst vereisen daarnaast inhoudelijke beoordeling van de preview." };
}
