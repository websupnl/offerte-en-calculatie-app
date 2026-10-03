"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Plus, Truck, Clock } from "lucide-react";
import { formatCurrency, formatRelativeDate } from "@/lib/format";

export type ArticlePickerProduct = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  unit: string;
  basePrice: number;
  costPrice: number | null;
  supplier?: string | null;
  sku?: string | null;
  ean?: string | null;
  priceUpdatedAt?: string | null;
};

export function ArticlePickerDialog({
  products,
  onSelect,
  onCreateNew,
  trigger,
  title = "Artikel zoeken",
}: {
  products: ArticlePickerProduct[];
  onSelect: (product: ArticlePickerProduct) => void;
  onCreateNew?: (query: string) => void;
  trigger?: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.supplier) set.add(p.supplier); });
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (supplierFilter !== "all" && p.supplier !== supplierFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.ean ?? "").toLowerCase().includes(q) ||
        (p.supplier ?? "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, supplierFilter]);

  function handleSelect(p: ArticlePickerProduct) {
    onSelect(p);
    setOpen(false);
    setQuery("");
  }

  function handleCreateNew() {
    onCreateNew?.(query.trim());
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex flex-1 min-w-0">
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1.5 h-4 w-4 text-muted-foreground" />
            Artikel toevoegen
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(760px,calc(100dvh-2rem))] w-[min(960px,calc(100vw-2rem))] max-w-none flex-col gap-4 p-5 sm:max-w-none sm:p-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex shrink-0 flex-col gap-2 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                aria-label="Zoek artikelen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam, EAN, artikelcode of leverancier"
                className="h-10 pl-10 text-base md:text-base"
              />
            </div>
            <div className="flex min-w-0 gap-2">
              {suppliers.length > 0 && (
                <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v || "all")}>
                  <SelectTrigger className="h-10 min-w-0 flex-1 text-base md:w-[190px] md:flex-none md:text-base">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Leverancier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle leveranciers</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {onCreateNew && (
                <Button type="button" variant="secondary" className="h-10 shrink-0 text-base" onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Nieuw artikel</span>
                  <span className="sr-only sm:hidden">Nieuw artikel</span>
                </Button>
              )}
            </div>
          </div>

          <div className="-mx-5 min-h-0 flex-1 overflow-y-auto border-y px-5 sm:-mx-6 sm:px-6">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-10 w-10" />
                <p className="text-base font-semibold text-foreground">Geen artikelen gevonden</p>
                <p className="mt-1 text-base">Pas je zoekterm of leverancier aan.</p>
                {onCreateNew && (
                  <Button type="button" size="sm" className="mt-4" onClick={handleCreateNew}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    {query.trim() ? `"${query.trim()}" aanmaken als nieuw artikel` : "Nieuw artikel aanmaken"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="flex w-full items-start justify-between gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 text-base font-medium text-foreground">{p.name}</span>
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {p.category}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {p.supplier && (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5" />
                            {p.supplier}
                          </span>
                        )}
                        {p.sku && <span>Art. {p.sku}</span>}
                        {p.ean && <span>EAN {p.ean}</span>}
                        {p.priceUpdatedAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            prijs {formatRelativeDate(p.priceUpdatedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold tabular-nums text-foreground">
                        {formatCurrency(p.costPrice != null ? p.costPrice : p.basePrice)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {p.costPrice != null ? "netto inkoop" : "verkoop"} · per {p.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 text-sm text-muted-foreground">
            {filtered.length} van {products.length} artikelen
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
