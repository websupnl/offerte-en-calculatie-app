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
            <Plus className="mr-1.5 h-4 w-4 text-slate-500" />
            Artikel toevoegen
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam, omschrijving, EAN, artikelcode of leverancier..."
                className="pl-8"
              />
            </div>
            {suppliers.length > 0 && (
              <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v || "all")}>
                <SelectTrigger className="w-[170px] shrink-0">
                  <Truck className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
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
              <Button type="button" variant="secondary" className="shrink-0" onClick={handleCreateNew}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nieuw artikel
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-[300px] -mx-6 px-6 border-t mt-1 pt-1">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 text-sm">Geen artikelen gevonden</p>
                <p className="text-xs text-slate-400 mt-1">Pas je zoekterm of leverancier-filter aan.</p>
                {onCreateNew && (
                  <Button type="button" size="sm" className="mt-4" onClick={handleCreateNew}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    {query.trim() ? `"${query.trim()}" aanmaken als nieuw artikel` : "Nieuw artikel aanmaken"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="w-full flex items-center justify-between gap-4 py-2.5 px-2 -mx-2 rounded-md text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-slate-900 truncate">{p.name}</p>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal shrink-0">
                          {p.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.supplier && (
                          <Badge className="text-[10px] py-0 px-1.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-100">
                            <Truck className="mr-1 h-2.5 w-2.5" />
                            {p.supplier}
                          </Badge>
                        )}
                        {p.sku && <span className="text-[10px] text-slate-400 font-mono">Art# {p.sku}</span>}
                        {p.ean && <span className="text-[10px] text-slate-400 font-mono">EAN {p.ean}</span>}
                        {p.priceUpdatedAt && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            prijs {formatRelativeDate(p.priceUpdatedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(p.costPrice != null ? p.costPrice : p.basePrice)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.costPrice != null ? "netto inkoop" : "verkoop"} · per {p.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 pt-1 text-[11px] text-slate-400">
            {filtered.length} van {products.length} artikelen
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
