"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search } from "lucide-react";

export function SearchablePopoverSelect<T>({
  items,
  value,
  onChange,
  getId,
  getLabel,
  getSublabel,
  placeholder = "Selecteren...",
  searchPlaceholder = "Zoeken...",
  emptyLabel = "Niets gevonden",
  allowClear = true,
  clearLabel = "— Geen —",
  className = "h-9 w-full justify-between font-normal bg-white",
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string | null | undefined;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = items.find((item) => getId(item) === value);
  const q = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!q) return true;
    const label = getLabel(item).toLowerCase();
    const sub = (getSublabel?.(item) ?? "").toLowerCase();
    return label.includes(q) || sub.includes(q);
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className={className}>
            <span className="truncate">{selected ? getLabel(selected) : placeholder}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        }
      />
      <PopoverContent align="start" className="z-[200] w-[280px] p-0 gap-0">
        <div className="p-2 border-b border-slate-100 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 text-sm pl-7"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-slate-100 text-slate-500 ${
                !value ? "bg-slate-100 font-semibold" : ""
              }`}
            >
              {clearLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-3 text-center">{emptyLabel}</p>
          ) : (
            filtered.map((item) => {
              const id = getId(item);
              const sub = getSublabel?.(item);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-slate-100 ${
                    id === value ? "bg-slate-100 font-semibold" : ""
                  }`}
                >
                  <span className="truncate block">{getLabel(item)}</span>
                  {sub && <span className="block text-[11px] text-slate-400 truncate">{sub}</span>}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
