export function defaultQuoteEmailMessage(companySlug: string) {
  return companySlug === "koolhaas"
    ? "Hierbij stuur ik u de offerte toe. Via onderstaande knop kunt u de offerte rustig bekijken en accorderen."
    : "Zoals besproken heb ik de offerte voor je klaargezet. Via onderstaande knop kun je de offerte rustig bekijken en accorderen.";
}

export function defaultQuoteExtensionSubject(companySlug: string, quoteNumber: string) {
  return `${companySlug === "koolhaas" ? "Uw" : "Je"} offerte ${quoteNumber} is verlengd`;
}

export function defaultQuoteExtensionMessage(companySlug: string) {
  return companySlug === "koolhaas"
    ? "Ik heb de offerte opnieuw voor u beschikbaar gemaakt. U kunt deze via de knop hieronder bekijken."
    : "Ik heb de offerte opnieuw voor je beschikbaar gemaakt. Je kunt deze via de knop hieronder bekijken.";
}
