"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Brain,
  TrendingUp,
  ShieldCheck,
  FolderKanban,
  ChevronDown,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navGroups = [
  {
    label: "Werk",
    items: [
      { href: "/dashboard", label: "Start", icon: LayoutDashboard },
      { href: "/projects", label: "Projecten", icon: FolderKanban, koolhaasOnly: true },
      { href: "/quotes", label: "Offertes", icon: FileText },
      { href: "/advice", label: "Technisch advies", icon: ShieldCheck },
    ],
  },
  {
    label: "Relaties",
    items: [{ href: "/customers", label: "Klanten", icon: Users }],
  },
  {
    label: "Catalogus",
    items: [
      { href: "/admin/products", label: "Artikelen & prijzen", icon: Package },
      { href: "/knowledge", label: "Kennisbank", icon: Brain },
    ],
  },
  {
    label: "Inzicht",
    items: [{ href: "/admin/dashboard", label: "Financieel inzicht", icon: TrendingUp }],
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
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/8 bg-[#0b1628] text-slate-200 shadow-2xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-[252px]",
          mobileOpen ? "w-[276px] translate-x-0" : "w-[276px] -translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-white/8 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Bedrijf wisselen: ${activeCompany?.name ?? "selecteer bedrijf"}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-lg border-0 bg-transparent p-2 text-left hover:bg-white/6",
                collapsed && "lg:justify-center",
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1">
                <Image src={logoSrc} alt="" width={64} height={64} className="h-full w-full object-contain" />
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                <p className="truncate text-sm font-bold text-white">{activeCompany?.name ?? "Bedrijf"}</p>
                <p className="truncate text-[11px] text-slate-400">Werkadministratie</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500", collapsed && "lg:hidden")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
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
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/8 hover:text-white lg:hidden"
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
              <div key={group.label} className="mb-5">
                <p className={cn("mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500", collapsed && "lg:text-center lg:px-0")}>
                  <span className={cn(collapsed && "lg:hidden")}>{group.label}</span>
                  <span className={cn("hidden", collapsed && "lg:inline")}>·</span>
                </p>
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
                          "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[#1d8d96] text-white shadow-[inset_3px_0_0_#72d4d5]"
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

        <div className="border-t border-white/8 p-3">
          <Link
            href="/admin/settings"
            onClick={onMobileClose}
            className={cn(
              "mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 hover:bg-white/7 hover:text-white",
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
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-300",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Uitloggen</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-lg border border-white/8 text-slate-500 hover:bg-white/6 hover:text-white lg:flex"
            aria-label={collapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
