"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronRight, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { AiStatusBadge } from "@/components/ai-status-badge";
import { GlobalSearch } from "@/components/layout/global-search";
import { Sidebar } from "@/components/layout/sidebar";
import { useCompany } from "@/lib/company-context";

const routeLabels: Record<string, string> = {
  dashboard: "Start",
  projects: "Projecten",
  workorders: "Werkbonnen",
  invoices: "Facturen",
  quotes: "Offertes",
  calculations: "Calculaties",
  calculatie: "Calculatie",
  customers: "Klanten",
  advice: "Adviesdocumenten",
  knowledge: "Kennisbank",
  admin: "Beheer",
  products: "Artikelen",
  settings: "Instellingen",
  werkplek: "Werkplek",
  tasks: "Taken",
  agenda: "Agenda",
  notes: "Notities",
  contracts: "Contracten",
  tracker: "Verzendtracker",
  review: "Reviews",
  new: "Nieuw",
};

const subscribeToHydration = () => () => {};

export function WorkspaceShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const { activeCompany } = useCompany();
  const { resolvedTheme, setTheme } = useTheme();
  const themeReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
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
    <div className="workspace-shell flex min-h-screen bg-[var(--ws-bg)] text-foreground">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleCollapsed}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-foreground lg:hidden"
            aria-label="Navigatie openen"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="hidden min-w-0 shrink-0 items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Kruimelpad">
            {crumbs.length === 0 ? (
              <span className="font-semibold text-foreground">Start</span>
            ) : (
              crumbs.map((crumb, index) => (
                <div key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <Link
                    href={crumb.href}
                    className={
                      index === crumbs.length - 1
                        ? "max-w-40 truncate rounded-lg px-2 py-1 font-semibold text-foreground"
                        : "max-w-40 truncate rounded-lg px-2 py-1 hover:bg-muted hover:text-foreground"
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
            className="mx-auto flex h-9 w-full min-w-0 max-w-xl flex-1 items-center gap-3 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              <span className="hidden xl:inline">Zoek klant, project, offerte, werkbon of artikel...</span>
              <span className="xl:hidden">Zoeken...</span>
            </span>
            <kbd className="hidden rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground sm:block">
              Ctrl K
            </kbd>
          </button>

          <Link
            href="/agenda"
            className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted lg:flex"
          >
            <CalendarDays className="h-4 w-4" />
            Planning
          </Link>
          <AiStatusBadge className="hidden lg:inline-flex" />
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={themeReady && resolvedTheme === "dark" ? "Lichte modus inschakelen" : "Donkere modus inschakelen"}
            title={themeReady && resolvedTheme === "dark" ? "Lichte modus" : "Donkere modus"}
          >
            {themeReady && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/quotes/new"
            className="hidden h-9 items-center rounded-lg bg-[var(--ws-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--ws-accent-hover)] sm:flex"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Offerte
          </Link>
          <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1 pr-3 lg:flex">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--ws-accent-soft)] text-xs font-bold text-[var(--ws-accent)]">
              {initials}
            </span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block max-w-40 truncate text-xs font-semibold text-foreground">{userName || "Gebruiker"}</span>
              <span className="block max-w-40 truncate text-xs text-muted-foreground">
                {activeCompany?.name ?? currentSection}
              </span>
            </span>
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)] min-w-0">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
