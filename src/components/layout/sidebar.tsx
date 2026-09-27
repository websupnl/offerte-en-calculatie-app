"use client";

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import {
  Brain,
  Building2,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Database,
  Eye,
  FileSignature,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LogOut,
  Package,
  ReceiptText,
  Repeat,
  Settings,
  ShieldCheck,
  StickyNote,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  koolhaasOnly?: boolean;
};

type NavGroup = { label: string | null; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Start", icon: LayoutDashboard },
      { href: "/customers", label: "Klanten", icon: Users },
      { href: "/quotes", label: "Offertes", icon: FileText },
      { href: "/calculations", label: "Calculaties", icon: Calculator },
      { href: "/projects", label: "Projecten", icon: FolderKanban },
      { href: "/invoices", label: "Facturen", icon: ReceiptText },
    ],
  },
  {
    label: "Werk",
    items: [
      { href: "/tasks", label: "Taken", icon: ListTodo },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/notes", label: "Notities", icon: StickyNote },
      { href: "/workorders", label: "Werkbonnen", icon: ClipboardList, koolhaasOnly: true },
      { href: "/contracts", label: "Contracten", icon: FileSignature },
      { href: "/subscriptions", label: "Abonnementen", icon: Repeat },
      { href: "/advice", label: "Adviesdocumenten", icon: ShieldCheck },
      { href: "/quotes/tracker", label: "Verzendtracker", icon: Eye },
    ],
  },
  {
    label: "Beheer",
    items: [
      { href: "/admin/products", label: "Artikelen", icon: Package },
      { href: "/knowledge", label: "Kennisbank", icon: Brain },
      { href: "/admin/dashboard", label: "Financieel inzicht", icon: TrendingUp },
      { href: "/admin/settings", label: "Inrichting", icon: Database },
      { href: "/settings/werkplek", label: "Werkplek & koppelingen", icon: Settings },
    ],
  },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onMobileClose,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { activeCompany, companies, switchingCompanyId, switchCompany } = useCompany();
  const logoSrc =
    activeCompany?.slug === "koolhaas"
      ? "/logos/koolhaas-logo-tight.png"
      : "/logos/websup-cover.png";

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Navigatie sluiten"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/8 bg-[var(--ws-sidebar)] text-white shadow-xl transition-[width,transform] duration-200",
          "lg:sticky lg:top-3 lg:z-30 lg:my-3 lg:ml-3 lg:h-[calc(100vh-24px)] lg:translate-x-0 lg:rounded-xl lg:border",
          collapsed ? "lg:w-[68px]" : "lg:w-[248px]",
          mobileOpen ? "w-[292px] translate-x-0" : "w-[292px] -translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Bedrijf wisselen: ${activeCompany?.name ?? "selecteer bedrijf"}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-transparent bg-transparent p-2 text-left hover:border-white/10 hover:bg-white/6",
                collapsed && "lg:justify-center",
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1">
                <Image src={logoSrc} alt="" width={64} height={64} className="h-full w-full object-contain" />
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                <p className="truncate text-sm font-bold text-white">{activeCompany?.name ?? "Bedrijf"}</p>
                <p className="truncate text-xs text-white/55">Werkplek</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/45", collapsed && "lg:hidden")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  disabled={switchingCompanyId !== null}
                  onClick={() => switchCompany(company.id)}
                  className={cn(company.id === activeCompany?.id && "bg-muted")}
                >
                  {switchingCompanyId === company.id ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="mr-2 h-4 w-4" />
                  )}
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-label="Navigatie sluiten"
            onClick={onMobileClose}
            className="grid h-9 w-9 place-items-center rounded-md text-white/60 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Hoofdnavigatie">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.koolhaasOnly || activeCompany?.slug === "koolhaas",
            );
            if (visibleItems.length === 0) return null;
            const groupActive = visibleItems.some((item) =>
              pathname === item.href || pathname.startsWith(`${item.href}/`),
            );
            const links = (
              <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(`${item.href}/`) &&
                        !navGroups.some((g) => g.items.some((other) => other.href !== item.href && other.href.startsWith(`${item.href}/`) && pathname.startsWith(other.href))));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={onMobileClose}
                        className={cn(
                          "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                          isActive
                            ? "bg-white/12 font-semibold text-white"
                            : "text-[var(--ws-sidebar-fg)] hover:bg-white/8 hover:text-white",
                          collapsed && "lg:justify-center lg:px-0",
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            );
            if (!group.label) return <div key="__home" className="mb-3">{links}</div>;
            return (
              <details key={`${group.label}-${collapsed}-${groupActive}`} open={collapsed || groupActive} className="group/section mb-2">
                <summary className={cn(
                  "flex h-9 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-semibold text-white/65 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [&::-webkit-details-marker]:hidden",
                  collapsed && "lg:hidden",
                )}>
                  {group.label}
                  <ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" />
                </summary>
                {links}
              </details>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/60 hover:bg-red-500/15 hover:text-red-200",
              collapsed && "lg:justify-center lg:rounded-xl lg:px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Uitloggen</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/8 hover:text-white lg:flex"
            aria-label={collapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
