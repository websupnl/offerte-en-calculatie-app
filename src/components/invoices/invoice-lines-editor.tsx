"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Package, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { formatCurrency } from "@/lib/format";

export type EditableLine = {
  key: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  basePrice: string | number;
  vatRate: string | number;
  sku: string | null;
};

let teller = 0;
export const newKey = () => `l${Date.now().toString(36)}${(teller++).toString(36)}`;

export function toEditable(lines: { description: string; qty: number | string; unit?: string | null; unitPrice: number | string; vatRate: number | string }[]): EditableLine[] {
  return lines.map((l) => ({
    key: newKey(),
    description: l.description,
    qty: Number(l.qty),
    unit: l.unit ?? "stuk",
    unitPrice: Number(l.unitPrice),
    vatRate: Number(l.vatRate),
  }));
}

export function stripKeys(lines: EditableLine[]) {
  return lines
    .filter((l) => l.description.trim())
    .map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, vatRate: l.vatRate }));
}

/** Btw per tarief, zoals hij ook op de factuur staat. */
export function vatBreakdown(lines: { qty: number; unitPrice: number; vatRate: number }[]) {
  const groups = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const base = l.qty * l.unitPrice;
    const g = groups.get(l.vatRate) ?? { base: 0, vat: 0 };
    g.base += base;
    g.vat += base * (l.vatRate / 100);
    groups.set(l.vatRate, g);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function ProductPicker({ onPick }: { onPick: (p: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || products) return;
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => setProducts([]));
  }, [open, products]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products ?? [];
    return (q ? list.filter((p) => `${p.name} ${p.sku ?? ""} ${p.category}`.toLowerCase().includes(q)) : list).slice(0, 40);
  }, [products, query]);

  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Package className="h-4 w-4" /> Artikel
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-950/10">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek artikel of SKU"
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {products === null && <li className="px-3 py-3 text-sm text-slate-500">Laden…</li>}
            {products && results.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Niets gevonden.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">{p.category}{p.sku ? ` · ${p.sku}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-700">
                    {formatCurrency(Number(p.basePrice))}<span className="text-xs text-slate-400">/{p.unit}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const num = (v: string) => (v === "" || v === "-" ? 0 : Number(v.replace(",", ".")));

export function InvoiceLinesEditor({
  lines,
  onChange,
  readOnly = false,
}: {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  readOnly?: boolean;
}) {
  const totals = computeInvoiceTotals(lines);
  const vat = vatBreakdown(lines);

  const update = (key: string, patch: Partial<EditableLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (line?: Partial<EditableLine>) =>
    onChange([...lines, { key: newKey(), description: "", qty: 1, unit: "stuk", unitPrice: 0, vatRate: 21, ...line }]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Regels</h2>
          <p className="text-xs text-slate-500">{lines.length} {lines.length === 1 ? "regel" : "regels"} · bedragen excl. btw</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <ProductPicker
              onPick={(p) =>
                add({
                  description: p.description ? `${p.name}\n${p.description}` : p.name,
                  unit: p.unit,
                  unitPrice: Number(p.basePrice),
                  vatRate: Number(p.vatRate),
                })
              }
            />
            <Button type="button" size="sm" onClick={() => add()}>
              <Plus className="h-4 w-4" /> Vrije regel
            </Button>
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">
          Nog geen regels. Voeg een artikel of vrije regel toe, of kies hierboven een bron.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          <div className="hidden grid-cols-[1fr_5rem_5rem_7rem_4.5rem_7rem_4.5rem] gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
            <span>Omschrijving</span>
            <span className="text-right">Aantal</span>
            <span>Eenheid</span>
            <span className="text-right">Prijs</span>
            <span className="text-right">Btw</span>
            <span className="text-right">Totaal</span>
            <span />
          </div>
          {lines.map((l, i) => (
            <div
              key={l.key}
              className="group grid grid-cols-2 gap-2 px-4 py-3 sm:px-5 md:grid-cols-[1fr_5rem_5rem_7rem_4.5rem_7rem_4.5rem] md:items-start"
            >
              <Textarea
                aria-label="Omschrijving"
                rows={Math.min(4, Math.max(1, l.description.split("\n").length))}
                className="col-span-2 min-h-9 resize-y md:col-span-1"
                placeholder="Omschrijving"
                value={l.description}
                readOnly={readOnly}
                onChange={(e) => update(l.key, { description: e.target.value })}
              />
              <Input
                aria-label="Aantal"
                inputMode="decimal"
                className="text-right tabular-nums"
                defaultValue={String(l.qty).replace(".", ",")}
                readOnly={readOnly}
                onChange={(e) => update(l.key, { qty: num(e.target.value) })}
              />
              <Input
                aria-label="Eenheid"
                value={l.unit}
                readOnly={readOnly}
                onChange={(e) => update(l.key, { unit: e.target.value })}
              />
              <Input
                aria-label="Prijs per eenheid"
                inputMode="decimal"
                className="text-right tabular-nums"
                defaultValue={String(l.unitPrice).replace(".", ",")}
                readOnly={readOnly}
                onChange={(e) => update(l.key, { unitPrice: num(e.target.value) })}
              />
              <select
                aria-label="Btw-tarief"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums"
                value={l.vatRate}
                disabled={readOnly}
                onChange={(e) => update(l.key, { vatRate: Number(e.target.value) })}
              >
                {[21, 9, 0].map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
                {![21, 9, 0].includes(l.vatRate) && <option value={l.vatRate}>{l.vatRate}%</option>}
              </select>
              <p className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-slate-900">
                {formatCurrency(l.qty * l.unitPrice)}
              </p>
              {!readOnly && (
                <div className="col-span-2 flex h-9 items-center justify-end gap-0.5 md:col-span-1">
                  <button type="button" aria-label="Omhoog" onClick={() => move(i, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Omlaag" onClick={() => move(i, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={i === lines.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Verwijderen" onClick={() => remove(l.key)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotaal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.totalExVat)}</dd>
          </div>
          {vat.map(([rate, g]) => (
            <div key={rate} className="flex justify-between">
              <dt className="text-slate-500">Btw {rate}%</dt>
              <dd className="tabular-nums">{formatCurrency(g.vat)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-950">
            <dt>Totaal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.totalIncVat)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
