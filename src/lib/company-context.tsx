"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
};

const CompanyContext = createContext<CompanyContextType>({
  activeCompany: null,
  companies: [],
  switchingCompanyId: null,
  switchCompany: async () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);

  const companies = session?.user?.companies ?? [];
  const activeCompany =
    companies.find((c) => c.id === session?.user?.activeCompanyId) ??
    companies[0] ??
    null;

  useEffect(() => {
    if (typeof document !== "undefined" && activeCompany) {
      document.documentElement.setAttribute("data-company", activeCompany.slug);
    }
  }, [activeCompany]);

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
      value={{ activeCompany, companies, switchingCompanyId, switchCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
