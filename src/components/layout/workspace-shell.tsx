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
  new: "Nieuw",
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

  const initials = (userName || "Gebruiker")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--ws-bg)] text-slate-950">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleCollapsed}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 bg-[var(--ws-bg)]/90 px-4 backdrop-blur md:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm lg:hidden"
            aria-label="Navigatie openen"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="hidden min-w-0 shrink-0 items-center gap-1 text-sm text-slate-500 md:flex">
            {crumbs.length === 0 ? (
              <span className="font-semibold text-slate-900">Start</span>
            ) : (
              crumbs.map((crumb, index) => (
                <div key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                  <Link
                    href={crumb.href}
                    className={
                      index === crumbs.length - 1
                        ? "max-w-40 truncate rounded-full px-2 py-1 font-semibold text-slate-900"
                        : "max-w-40 truncate rounded-full px-2 py-1 hover:bg-white hover:text-slate-900"
                    }
                  >
                    {crumb.label}
                  </Link>
                </div>
              ))
            )}
          </nav>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto flex h-10 w-full min-w-0 max-w-xl flex-1 items-center gap-3 rounded-full bg-white px-4 text-left text-sm text-slate-500 shadow-sm transition-shadow hover:shadow-md"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              <span className="hidden xl:inline">Zoek klant, project, offerte, werkbon of artikel...</span>
              <span className="xl:hidden">Zoeken...</span>
            </span>
            <kbd className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-400 sm:block">
              Ctrl K
            </kbd>
          </button>

          <Link
            href="/projects"
            className="hidden h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm hover:text-slate-900 lg:flex"
          >
            <CalendarDays className="h-4 w-4" />
            Planning
          </Link>
          <Link
            href="/quotes/new"
            className="hidden h-10 items-center rounded-full bg-[var(--ws-accent)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--ws-accent-hover)] sm:flex"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Offerte
          </Link>
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-full bg-white text-slate-500 shadow-sm hover:text-slate-900 lg:grid"
            aria-label="Meldingen"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="hidden shrink-0 items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-sm lg:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ws-accent-soft)] text-[11px] font-bold text-[var(--ws-accent)]">
              {initials}
            </span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block max-w-40 truncate text-xs font-semibold text-slate-800">{userName || "Gebruiker"}</span>
              <span className="block max-w-40 truncate text-[11px] text-slate-400">
                {activeCompany?.name ?? currentSection}
              </span>
            </span>
          </div>
        </header>
        <main className="min-h-[calc(100vh-72px)] min-w-0">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
