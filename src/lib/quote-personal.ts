import type { CompanyBranding } from "./branding";

export const PERSONAL_QUOTE_MESSAGE = "Ik heb deze offerte opgesteld op basis van jouw wensen. Heb je vragen of wil je iets aanpassen? App me gerust, dan kijken we er samen naar.";

export function quotePersonalProfile(branding?: Partial<CompanyBranding>) {
  const name = branding?.personalName?.trim() || "Daan Koolhaas";
  const phone = branding?.personalWhatsapp?.trim() || "06 82 20 21 48";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `31${digits.slice(1)}`;
  return {
    name,
    photo: "/logos/daan-koolhaas.jpg",
    message: branding?.personalMessage?.trim() || PERSONAL_QUOTE_MESSAGE,
    whatsappUrl: /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : null,
    phone,
  };
}
