import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";
import { DEFAULT_SETTINGS } from "@/lib/branding";

export default async function SettingsPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) return <div className="p-8">Geen bedrijf geselecteerd.</div>;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return <div className="p-8">Bedrijf niet gevonden.</div>;

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  const branding = (company.branding ?? {}) as Record<string, unknown>;

  return (
    <SettingsClient
      companyId={companyId}
      companyName={company.name}
      companySlug={company.slug}
      settings={{
        defaultVatRate: (settings.defaultVatRate as number) ?? DEFAULT_SETTINGS.defaultVatRate,
        quoteValidDays: (settings.quoteValidDays as number) ?? DEFAULT_SETTINGS.quoteValidDays,
        quoteIntroDefault: (settings.quoteIntroDefault as string) ?? DEFAULT_SETTINGS.quoteIntroDefault,
        quoteOutroDefault: (settings.quoteOutroDefault as string) ?? DEFAULT_SETTINGS.quoteOutroDefault,
        paymentTerms: (settings.paymentTerms as string) ?? DEFAULT_SETTINGS.paymentTerms,
        openaiApiKey: (settings.openaiApiKey as string) ?? "",
        emailFrom: (settings.emailFrom as string) ?? "",
        notifyEmail: (settings.notifyEmail as string) ?? "",
        aiSystemPrompts: (settings.aiSystemPrompts as Record<string, string>) ?? DEFAULT_SETTINGS.aiSystemPrompts,
      }}
      branding={{
        primaryColor: (branding.primaryColor as string) ?? "",
        accentColor: (branding.accentColor as string) ?? "",
        tagline: (branding.tagline as string) ?? "",
      }}
    />
  );
}
