"use client";

import { createContext, useContext, useEffect } from "react";
import { useSession } from "next-auth/react";

type Company = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type CompanyContextType = {
  activeCompany: Company | null;
  companies: Company[];
  switchCompany: (companyId: string) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  activeCompany: null,
  companies: [],
  switchCompany: async () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();

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
    await update({ activeCompanyId: companyId });
  }

  return (
    <CompanyContext.Provider value={{ activeCompany, companies, switchCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
