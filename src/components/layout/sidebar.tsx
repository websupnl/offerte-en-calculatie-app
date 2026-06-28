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
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
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
    items: [{ href: "/dashboard", label: "Start", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { href: "/customers", label: "Klanten", icon: Users },
      { href: "/quotes", label: "Offertes", icon: FileText },
      { href: "/advice", label: "Adviesdocumenten", icon: ShieldCheck },
    ],
  },
  {
    label: "Operatie",
    items: [
      { href: "/projects", label: "Projecten", icon: FolderKanban, koolhaasOnly: true },
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#18304c] bg-[#071421] text-slate-200 shadow-2xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0",
          collapsed ? "lg:w-[78px]" : "lg:w-[286px]",
          mobileOpen ? "w-[292px] translate-x-0" : "w-[292px] -translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-[#18304c] px-3">
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
                <p className="truncate text-[11px] text-slate-400">ERP & CRM werkplek</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500", collapsed && "lg:hidden")} />
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
            className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
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
                      "mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500",
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
                          "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[#0f7b83] text-white shadow-[inset_3px_0_0_#7bd6d9]"
                            : "text-slate-400 hover:bg-white/7 hover:text-white",
                          collapsed && "lg:justify-center lg:px-0",
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

        <div className="border-t border-[#18304c] p-3">
          <div className={cn("mb-3 rounded-md border border-white/8 bg-white/5 p-3", collapsed && "lg:grid lg:place-items-center lg:p-2")}>
            <BriefcaseBusiness className="h-[18px] w-[18px] shrink-0 text-teal-300" />
            <div className={cn("mt-2", collapsed && "lg:hidden")}>
              <p className="text-xs font-semibold text-white">Werkproces</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">Relatie, offerte, project, werkbon en factuur.</p>
            </div>
          </div>
          <Link
            href="/admin/settings"
            onClick={onMobileClose}
            className={cn(
              "mb-1 flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-400 hover:bg-white/7 hover:text-white",
              pathname.startsWith("/admin/settings") && "bg-white/8 text-white",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Instellingen</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-300",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Uitloggen</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-md border border-white/8 text-slate-500 hover:bg-white/6 hover:text-white lg:flex"
            aria-label={collapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
