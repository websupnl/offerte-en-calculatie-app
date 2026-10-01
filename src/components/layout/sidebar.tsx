"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { Brain, Building2, Calculator, CalendarDays, ChevronDown, ClipboardList, Database, Eye, FileSignature, FileText, FolderKanban, LayoutDashboard, ListTodo, LoaderCircle, LogOut, Package, ReceiptText, Repeat, Settings, ShieldCheck, StickyNote, TrendingUp, Users, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; koolhaasOnly?: boolean };
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "Werkplek", items: [
    { href: "/dashboard", label: "Start", icon: LayoutDashboard },
    { href: "/calculations", label: "Calculaties", icon: Calculator },
    { href: "/quotes", label: "Offertes", icon: FileText },
    { href: "/customers", label: "Klanten", icon: Users },
    { href: "/projects", label: "Projecten", icon: FolderKanban },
    { href: "/invoices", label: "Facturen", icon: ReceiptText },
  ] },
  { label: "Organiseren", items: [
    { href: "/tasks", label: "Taken", icon: ListTodo },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/notes", label: "Notities", icon: StickyNote },
    { href: "/workorders", label: "Werkbonnen", icon: ClipboardList, koolhaasOnly: true },
    { href: "/contracts", label: "Contracten", icon: FileSignature },
    { href: "/subscriptions", label: "Abonnementen", icon: Repeat },
    { href: "/advice", label: "Adviesdocumenten", icon: ShieldCheck },
    { href: "/quotes/tracker", label: "Verzendtracker", icon: Eye },
  ] },
  { label: "Beheer", items: [
    { href: "/admin/products", label: "Artikelen", icon: Package },
    { href: "/knowledge", label: "Kennisbank", icon: Brain },
    { href: "/admin/dashboard", label: "Financieel inzicht", icon: TrendingUp },
    { href: "/admin/settings", label: "Instellingen", icon: Database },
    { href: "/settings/werkplek", label: "Koppelingen", icon: Settings },
  ] },
];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const { activeCompany, companies, switchingCompanyId, switchCompany, branding } = useCompany();
  const storedLogo = branding?.logoUrl;
  const logoSrc = storedLogo?.startsWith("s3://") && activeCompany
    ? `/api/brand-assets/${activeCompany.id}/logo`
    : storedLogo || (activeCompany?.slug === "koolhaas" ? "/logos/koolhaas-logo-tight.png" : "/logos/websup-cover.png");
  const activeHref = navGroups.flatMap(group => group.items)
    .filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const desktop = useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
  const content = <>
      <div className="flex h-[72px] shrink-0 items-center gap-1 border-b border-border px-3">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Bedrijf wisselen: ${activeCompany?.name ?? "selecteer bedrijf"}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white p-1">
              <Image src={logoSrc} alt="" width={64} height={64} unoptimized className="size-full object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{activeCompany?.name ?? "Mijn werkplek"}</span>
              <span className="block text-sm text-muted-foreground">{activeCompany ? "Bedrijfswerkplek" : "Werkplek"}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {companies.map(company => <DropdownMenuItem key={company.id} disabled={switchingCompanyId !== null} onClick={() => switchCompany(company.id)} className={cn(company.id === activeCompany?.id && "bg-muted")}>
              {switchingCompanyId === company.id ? <LoaderCircle className="size-4 animate-spin" /> : <Building2 className="size-4" />}
              {company.name}
            </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" aria-label="Navigatie sluiten" onClick={onMobileClose} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"><X className="size-4" /></button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Hoofdnavigatie">
        {navGroups.map(group => <section key={group.label}>
          <h2 className="mb-2 px-3 text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="space-y-0.5">
            {group.items.filter(item => !item.koolhaasOnly || activeCompany?.slug === "koolhaas").map(item => {
              const selected = activeHref === item.href;
              return <Link key={item.href} href={item.href} prefetch={false} onClick={onMobileClose} aria-current={selected ? "page" : undefined} className={cn(
                "relative isolate flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9",
                selected ? "font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}>
                {selected && <m.span layoutId="workspace-navigation" transition={{ type: "spring", stiffness: 480, damping: 40 }} className="absolute inset-0 -z-10 rounded-lg border border-border bg-muted" />}
                <item.icon className={cn("size-[18px] shrink-0", selected && "text-primary")} />
                <span className="truncate">{item.label}</span>
                {selected && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" />}
              </Link>;
            })}
          </div>
        </section>)}
      </nav>
      <div className="shrink-0 border-t border-border p-3">
        <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogOut className="size-[18px]" />Uitloggen
        </button>
      </div>

  </>;
  if (desktop) return <aside aria-label="Werkpleknavigatie" className="workspace-sidebar sticky top-0 z-30 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-border bg-card lg:flex">{content}</aside>;
  return <Sheet open={mobileOpen} onOpenChange={open => { if (!open) onMobileClose(); }}>
    <SheetContent side="left" showCloseButton={false} className="gap-0! w-[280px]! max-w-[calc(100vw-2rem)]! bg-card">
      <SheetTitle className="sr-only">Werkpleknavigatie</SheetTitle>
      {content}
    </SheetContent>
  </Sheet>;
}
