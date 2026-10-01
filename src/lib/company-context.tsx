"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { cssFontFromBranding, cssVarsFromBranding, getBranding, type CompanyBranding } from "@/lib/branding";

function readableTextColor(hex: string) {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16) / 255);
  const luminance = [r, g, b].map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? "#101820" : "#ffffff";
}

type Company = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type CompanyContextType = {
  activeCompany: Company | null;
  companies: Company[];
  switchingCompanyId: string | null;
  switchCompany: (companyId: string) => Promise<void>;
  branding: CompanyBranding | null;
  reloadBranding: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  activeCompany: null,
  companies: [],
  switchingCompanyId: null,
  switchCompany: async () => {},
  branding: null,
  reloadBranding: async () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const companies = session?.user?.companies ?? [];
  const activeCompany =
    companies.find((c) => c.id === session?.user?.activeCompanyId) ??
    companies[0] ??
    null;

  useEffect(() => {
    if (!activeCompany) return;
    document.documentElement.setAttribute("data-company", activeCompany.slug);
    let cancelled = false;
    fetch(`/api/company/${activeCompany.id}/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Branding laden mislukt");
        return response.json() as Promise<{ branding?: Partial<CompanyBranding> }>;
      })
      .then((data) => { if (!cancelled) setBranding(getBranding(activeCompany.slug, data.branding)); })
      .catch(() => { if (!cancelled) setBranding(getBranding(activeCompany.slug)); });
    return () => { cancelled = true; };
  }, [activeCompany]);

  useEffect(() => {
    if (!activeCompany || !branding) return;
    const root = document.documentElement;
    // Document colors and workbench tokens have separate roles. Tailwind's
    // semantic colors must keep following the light/dark workbench theme.
    for (const name of ["--color-primary", "--color-accent", "--color-background", "--color-text"]) root.style.removeProperty(name);
    for (const [name, value] of Object.entries(cssVarsFromBranding(branding))) {
      if (name.startsWith("--brand-")) root.style.setProperty(name, value);
    }
    root.style.setProperty("--primary", branding.accentColor);
    root.style.setProperty("--primary-foreground", readableTextColor(branding.accentColor));
    root.style.setProperty("--accent", "var(--muted)");
    root.style.setProperty("--accent-foreground", "var(--foreground)");
    root.style.setProperty("--ws-accent", branding.accentColor);
    root.style.setProperty("--ws-accent-hover", `color-mix(in srgb, ${branding.accentColor}, #000 18%)`);
    root.style.setProperty("--ws-accent-soft", `color-mix(in srgb, ${branding.accentColor}, transparent 88%)`);
    root.style.setProperty("--brand-font", cssFontFromBranding(branding.font));
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", branding.primaryColor);
    const favicon = branding.faviconUrl.startsWith("s3://")
      ? `/api/brand-assets/${activeCompany.id}/favicon`
      : branding.faviconUrl;
    let icon = document.querySelector<HTMLLinkElement>('link[data-company-favicon="true"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      icon.dataset.companyFavicon = "true";
      document.head.appendChild(icon);
    }
    icon.href = favicon;
  }, [activeCompany, branding]);

  async function reloadBranding() {
    if (!activeCompany) return;
    const response = await fetch(`/api/company/${activeCompany.id}/settings`);
    if (!response.ok) throw new Error("Branding laden mislukt");
    const data = await response.json() as { branding?: Partial<CompanyBranding> };
    setBranding(getBranding(activeCompany.slug, data.branding));
  }

  async function switchCompany(companyId: string) {
    if (companyId === activeCompany?.id || switchingCompanyId) return;

    setSwitchingCompanyId(companyId);
    try {
      const response = await fetch("/api/company/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const result = (await response.json().catch(() => null)) as
        | { activeCompanyId?: string; error?: string }
        | null;

      if (!response.ok || result?.activeCompanyId !== companyId) {
        throw new Error(result?.error ?? "Bedrijfswissel mislukt");
      }

      window.location.reload();
    } catch (error) {
      setSwitchingCompanyId(null);
      toast.error(error instanceof Error ? error.message : "Bedrijfswissel mislukt");
    }
  }

  return (
    <CompanyContext.Provider
      value={{ activeCompany, companies, switchingCompanyId, switchCompany, branding, reloadBranding }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
