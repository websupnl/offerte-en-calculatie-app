export function defaultQuoteEmailMessage(companySlug: string) {
  return companySlug === "koolhaas"
    ? "Hierbij stuur ik u de offerte toe. Via onderstaande knop kunt u de offerte rustig bekijken en accorderen."
    : "Zoals besproken heb ik de offerte voor je klaargezet. Via onderstaande knop kun je de offerte rustig bekijken en accorderen.";
}
