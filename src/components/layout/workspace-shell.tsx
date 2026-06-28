"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, Menu, Plus, Search } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { Sidebar } from "@/components/layout/sidebar";
import { useCompany } from "@/lib/company-context";

const routeLabels: Record<string, string> = {
  dashboard: "Start",
  projects: "Projecten",
  workorders: "Werkbonnen",
  invoices: "Facturen",
  quotes: "Offertes",
  customers: "Klanten",
  advice: "Adviesdocumenten",
  knowledge: "Kennisbank",
  admin: "Beheer",
  products: "Artikelen",
  settings: "Instellingen",
};

export function WorkspaceShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const { activeCompany } = useCompany();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("workspace-sidebar-collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments
      .map((segment, index) => ({
        segment,
        label: routeLabels[segment] ?? (segment.length > 18 ? "Detail" : segment),
        href: `/${segments.slice(0, index + 1).join("/")}`,
      }))
      .filter((crumb) => crumb.segment !== "admin")
      .slice(0, 3);
  }, [pathname]);

  const currentSection = crumbs.at(-1)?.label ?? "Werkplek";

  function toggleCollapsed() {
    setCollapsed((current) => {
      window.localStorage.setItem("workspace-sidebar-collapsed", String(!current));
      return !current;
    });
  }

  return (
    <div className="flex min-h-screen bg-[#eef3f6] text-slate-950">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleCollapsed}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
            aria-label="Navigatie openen"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden min-w-0 flex-col md:flex">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#167f88]">Werkplek</p>
            <nav className="mt-1 flex min-w-0 items-center gap-1 text-sm text-slate-500">
              {crumbs.length === 0 ? (
                <span className="font-semibold text-slate-900">Start</span>
              ) : (
                crumbs.map((crumb, index) => (
                  <div key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                    <Link
                      href={crumb.href}
                      className="max-w-40 truncate rounded px-1.5 py-1 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {crumb.label}
                    </Link>
                  </div>
                ))
              )}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto flex h-10 w-full max-w-2xl items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-white"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Zoek klant, project, offerte, werkbon of artikel...</span>
            <kbd className="hidden rounded border bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
              Ctrl K
            </kbd>
          </button>

          <Link
            href="/projects"
            className="hidden h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 xl:flex"
          >
            <CalendarDays className="h-4 w-4" />
            Planning
          </Link>
          <Link
            href="/quotes/new"
            className="hidden h-9 items-center rounded-md bg-[#167f88] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#116b73] sm:flex"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Offerte
          </Link>
          <button
            type="button"
            className="hidden h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 xl:grid"
            aria-label="Meldingen"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="hidden min-w-0 border-l border-slate-200 pl-4 text-right xl:block">
            <p className="max-w-44 truncate text-xs font-semibold text-slate-800">{userName || "Gebruiker"}</p>
            <p className="max-w-44 truncate text-[11px] text-slate-400">
              {activeCompany?.name ?? currentSection}
            </p>
          </div>
        </header>
        <main className="min-h-[calc(100vh-72px)] min-w-0">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
