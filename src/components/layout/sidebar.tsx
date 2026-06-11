"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Zap,
  Brain,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "Offertes", icon: FileText },
  { href: "/customers", label: "Klanten", icon: Users },
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/knowledge", label: "Kennisbank", icon: Brain },
  { href: "/admin/settings", label: "Instellingen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { activeCompany, companies, switchCompany } = useCompany();

  const companyColor =
    activeCompany?.slug === "koolhaas" ? "text-green-600" : "text-indigo-600";

  return (
    <aside className="w-64 min-h-screen flex flex-col bg-card border-r">
      {/* Company switcher */}
      <div className="p-4 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left bg-transparent border-0 cursor-pointer"
          >
            <div className={cn("p-1.5 rounded-md bg-primary/10", companyColor)}>
              {activeCompany?.slug === "koolhaas" ? (
                <Zap className="h-4 w-4" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {activeCompany?.name ?? "Selecteer bedrijf"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {activeCompany?.slug}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {companies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => switchCompany(c.id)}
                className={cn(c.id === activeCompany?.id && "bg-muted")}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </Button>
      </div>
    </aside>
  );
}
