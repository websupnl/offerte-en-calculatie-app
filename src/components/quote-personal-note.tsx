import { MessageCircle } from "lucide-react";
import { quotePersonalProfile } from "@/lib/quote-personal";
import type { CompanyBranding } from "@/lib/branding";

export function QuotePersonalNote({ branding, portal = false }: { branding?: Partial<CompanyBranding>; portal?: boolean }) {
  const profile = quotePersonalProfile(branding);
  return (
    <section className={`quote-personal-note${portal ? " portal-card" : ""}`} aria-label="Mijn voorstel voor jou">
      <div className="quote-personal-identity">
        {/* eslint-disable-next-line @next/next/no-img-element -- gedeelde foto voor document en portaal */}
        <img src={profile.photo} alt={profile.name} width={56} height={56} />
        <div><h3>Mijn voorstel voor jou</h3><strong>{profile.name}</strong></div>
      </div>
      <p>{profile.message}</p>
      {profile.whatsappUrl && (
        <a className="quote-personal-action" href={profile.whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} aria-hidden="true" /> Stuur me een bericht
        </a>
      )}
    </section>
  );
}
