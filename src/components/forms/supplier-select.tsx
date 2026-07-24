"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPLIERS } from "@/lib/format";
import { X } from "lucide-react";

const CUSTOM = "__custom__";

export function SupplierSelect({
  value,
  onChange,
  extraSuppliers = [],
}: {
  value: string;
  onChange: (value: string) => void;
  extraSuppliers?: (string | null | undefined)[];
}) {
  const options = [...new Set([...SUPPLIERS, ...extraSuppliers.filter((s): s is string => Boolean(s))])].sort();
  const isKnown = !value || options.includes(value);
  const [customMode, setCustomMode] = useState(!isKnown);

  if (customMode) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Naam leverancier"
          autoFocus
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => {
        if (v === CUSTOM) {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(!v || v === "none" ? "" : v);
        }
      }}
    >
      <SelectTrigger className="bg-white">
        <SelectValue placeholder="Kies leverancier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— Geen leverancier —</SelectItem>
        {options.map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
        <SelectItem value={CUSTOM}>Andere leverancier...</SelectItem>
      </SelectContent>
    </Select>
  );
}
