"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, ChevronRight, FileText, Menu, Moon, Plus, Search, Sun, Users } from "lucide-react";
import { LazyMotion, domAnimation, m, MotionConfig } from "motion/react";
import { useTheme } from "next-themes";
import { AiStatusBadge } from "@/components/ai-status-badge";
import { GlobalSearch } from "@/components/layout/global-search";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const routeLabels: Record<string, string> = {
  dashboard: "Start", projects: "Projecten", workorders: "Werkbonnen", invoices: "Facturen",
  quotes: "Offertes", calculations: "Calculaties", calculatie: "Calculatie", customers: "Klanten",
  advice: "Adviesdocumenten", knowledge: "Kennisbank", products: "Artikelen", settings: "Instellingen",
  werkplek: "Koppelingen", tasks: "Taken", agenda: "Agenda", notes: "Notities", contracts: "Contracten",
  subscriptions: "Abonnementen", tracker: "Verzendtracker", review: "Reviews", new: "Nieuw",
};
const subscribeToHydration = () => () => {};

export function WorkspaceShell({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const themeReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(open => !open);
      }
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      label: routeLabels[segment] ?? "Detail", segment,
      href: `/${segments.slice(0, index + 1).join("/")}`,
    })).filter(crumb => crumb.segment !== "admin").slice(0, 3);
  }, [pathname]);

  return <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
    <LazyMotion features={domAnimation}>
      <div className="workspace-shell flex min-h-dvh bg-[var(--ws-bg)] text-foreground">
        <a href="#workspace-content" className="sr-only z-[100] rounded-md bg-card px-4 py-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ga naar inhoud</a>
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[56px] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden" aria-label="Navigatie openen" aria-expanded={mobileOpen}><Menu /></Button>
            <nav className="hidden min-w-0 items-center gap-1 text-sm md:flex" aria-label="Kruimelpad">
              {crumbs.map((crumb, index) => <span key={crumb.href} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                {index === crumbs.length - 1 ? <span className="max-w-40 truncate px-1 font-medium">{crumb.label}</span> : <Link href={crumb.href} className="max-w-40 truncate rounded-md px-1 text-muted-foreground hover:text-foreground">{crumb.label}</Link>}
              </span>)}
            </nav>
            <button type="button" onClick={() => setSearchOpen(true)} className="ml-auto flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Doorzoek de werkplek">
              <Search className="size-4 shrink-0" /><span className="hidden sm:inline">Zoek in je werkplek</span><kbd className="hidden rounded border border-border px-1.5 text-sm lg:block">Ctrl K</kbd>
            </button>
            <AiStatusBadge className="hidden xl:inline-flex" />
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={themeReady && resolvedTheme === "dark" ? "Lichte modus inschakelen" : "Donkere modus inschakelen"}>
              {themeReady && resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" />}><Plus /><span className="hidden sm:inline">Nieuw</span><span className="sr-only sm:hidden">Nieuw aanmaken</span></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem render={<Link href="/calculations?create=1" />}><Calculator />Calculatie</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/quotes/new" />}><FileText />Conceptofferte</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/customers?create=1" />}><Users />Klant</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="sr-only">Ingelogd als {userName || "gebruiker"}</span>
          </header>
          <main id="workspace-content" tabIndex={-1} className="min-h-[calc(100dvh-56px)] min-w-0 outline-none">
            <m.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>{children}</m.div>
          </main>
        </div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </LazyMotion>
  </MotionConfig>;
}
