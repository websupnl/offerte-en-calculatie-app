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
  FileSignature,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LogOut,
  Package,
  ReceiptText,
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
      { href: "/tasks", label: "Taken", icon: ListTodo },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/notes", label: "Notities", icon: StickyNote },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/customers", label: "Klanten", icon: Users },
      { href: "/calculations", label: "Calculaties", icon: Calculator },
      { href: "/quotes", label: "Offertes", icon: FileText },
      { href: "/contracts", label: "Contracten", icon: FileSignature },
      { href: "/advice", label: "Adviesdocumenten", icon: ShieldCheck },
    ],
  },
  {
    label: "Operatie",
    items: [
      // Projecten staan bewust voor beide bedrijven aan: bij WebsUp zijn ze de
      // drager van klantfeedback (zie PLAN-werkplek.md fase 5/6).
      { href: "/projects", label: "Projecten", icon: FolderKanban },
      { href: "/workorders", label: "Werkbonnen", icon: ClipboardList, koolhaasOnly: true },
      { href: "/invoices", label: "Facturen", icon: ReceiptText, koolhaasOnly: true },
    ],
  },
  {
    label: "ERP",
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
          "fixed inset-y-0 left-0 z-50 flex flex-col rounded-r-2xl bg-[var(--ws-sidebar)] text-slate-200 shadow-xl transition-[width,transform] duration-200",
          "lg:sticky lg:top-4 lg:z-30 lg:my-4 lg:ml-4 lg:h-[calc(100vh-32px)] lg:translate-x-0 lg:rounded-2xl",
          collapsed ? "lg:w-[78px]" : "lg:w-[276px]",
          mobileOpen ? "w-[292px] translate-x-0" : "w-[292px] -translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Bedrijf wisselen: ${activeCompany?.name ?? "selecteer bedrijf"}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-md border border-transparent bg-transparent p-2 text-left hover:border-white/10 hover:bg-white/6",
                collapsed && "lg:justify-center",
              )}
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1 shadow-sm">
                <Image src={logoSrc} alt="" width={64} height={64} className="h-full w-full object-contain" />
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                <p className="truncate text-sm font-bold text-white">{activeCompany?.name ?? "Bedrijf"}</p>
                <p className="truncate text-[11px] text-white/50">ERP & CRM werkplek</p>
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

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.koolhaasOnly || activeCompany?.slug === "koolhaas",
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label ?? "__home"} className="mb-5">
                {group.label && (
                  <p
                    className={cn(
                      "mb-1.5 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40",
                      collapsed && "lg:px-0 lg:text-center",
                    )}
                  >
                    <span className={cn(collapsed && "lg:hidden")}>{group.label}</span>
                    <span className={cn("hidden", collapsed && "lg:inline")}>-</span>
                  </p>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={onMobileClose}
                        className={cn(
                          "group flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[var(--ws-pill)] font-semibold text-[var(--ws-pill-fg)] shadow-sm"
                            : "text-[var(--ws-sidebar-fg)] hover:bg-white/8 hover:text-white",
                          collapsed && "lg:justify-center lg:rounded-xl lg:px-0",
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/admin/settings"
            onClick={onMobileClose}
            className={cn(
              "mb-1 flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium text-[var(--ws-sidebar-fg)] hover:bg-white/8 hover:text-white",
              pathname.startsWith("/admin/settings") && "bg-white/10 text-white",
              collapsed && "lg:justify-center lg:rounded-xl lg:px-0",
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Instellingen</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-full px-4 text-sm font-medium text-white/50 hover:bg-red-500/15 hover:text-red-200",
              collapsed && "lg:justify-center lg:rounded-xl lg:px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Uitloggen</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/8 hover:text-white lg:flex"
            aria-label={collapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
