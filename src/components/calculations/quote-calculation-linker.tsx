"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";

type Row = {
  id: string;
  number: string;
  title: string;
  quoteId: string | null;
  customerId: string | null;
  totalSalesPrice: number;
  customer: { id: string; name: string } | null;
  quote: { id: string; number: string | null; status: string } | null;
};

type Role = "BASE" | "VARIANT";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Calculaties koppelen vanaf de offerte zelf. Je ziet alleen wat kan: calculaties
 * van deze klant of nog zonder klant, die nog op geen enkele offerte zitten.
 * De regels van de API (alleen conceptofferte, dezelfde klant, nooit precies een
 * variant) staan er ook hier, zodat je de fout ziet voordat je op de knop drukt.
 */
export function QuoteCalculationLinker({
  quoteId,
  customerId,
  linked,
  onClose,
}: {
  quoteId: string;
  customerId: string;
  linked: { id: string; role: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calculations?summary=1")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Laden mislukt"))))
      .then((data: Row[]) => { if (!cancelled) setRows(data); })
      .catch((error) => { if (!cancelled) { toast.error(error instanceof Error ? error.message : "Laden mislukt"); setRows([]); } });
    return () => { cancelled = true; };
  }, []);

  const available = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => !row.quoteId && (!row.customerId || row.customerId === customerId))
      .filter((row) => !query || row.title.toLowerCase().includes(query) || row.number.toLowerCase().includes(query))
      // Eerst die van deze klant, dan die nog zonder klant.
      .sort((a, b) => Number(b.customerId === customerId) - Number(a.customerId === customerId));
  }, [rows, search, customerId]);

  const variantTotal =
    linked.filter((calculation) => calculation.role === "VARIANT").length +
    Object.values(picked).filter((role) => role === "VARIANT").length;
  const singleVariant = variantTotal === 1;
  const count = Object.keys(picked).length;

  function toggle(id: string) {
    setPicked((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = "BASE";
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch("/api/calculations/link-to-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, calculations: Object.entries(picked).map(([id, role]) => ({ id, role })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Koppelen mislukt");
      toast.success(`${result.affected} calculatie${result.affected === 1 ? "" : "s"} gekoppeld`);
      router.refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Koppelen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Calculatie koppelen</DialogTitle>
          <DialogDescription className="text-base">
            Basis telt altijd mee in de prijs. Vanaf twee varianten kiest de klant er één.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Zoek calculatie"
            placeholder="Zoek op titel of nummer..."
            className="pl-9 text-base"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {rows === null ? (
          <p className="py-6 text-center text-base text-muted-foreground">Calculaties laden...</p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-base text-muted-foreground">
            Geen losse calculaties voor deze klant. Maak er een via Calculaties, of maak ze vrij door ze van een andere offerte los te koppelen.
          </p>
        ) : (
          <ul className="space-y-2">
            {available.map((row) => {
              const checked = Boolean(picked[row.id]);
              return (
                <li key={row.id} className={`rounded-lg border p-3 ${checked ? "border-[var(--ws-accent)] bg-[var(--ws-accent-soft)]" : "border-border"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      id={`link-${row.id}`}
                      type="checkbox"
                      className="mt-1 h-4 w-4 cursor-pointer accent-[var(--ws-accent)]"
                      checked={checked}
                      onChange={() => toggle(row.id)}
                      disabled={busy}
                    />
                    <label htmlFor={`link-${row.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-base font-semibold">{row.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {row.number} · {row.customer?.name ?? "Nog geen klant"} · {formatCurrency(row.totalSalesPrice)} excl. btw
                      </span>
                    </label>
                    {checked && (
                      <select
                        aria-label={`Rol van ${row.number}`}
                        className={selectClass}
                        value={picked[row.id]}
                        onChange={(event) => setPicked((previous) => ({ ...previous, [row.id]: event.target.value as Role }))}
                        disabled={busy}
                      >
                        <option value="BASE">Basis</option>
                        <option value="VARIANT">Variant</option>
                      </select>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {singleVariant && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Eén variant is geen keuze. Kies er minimaal twee, of zet deze op Basis.
          </p>
        )}

        <DialogFooter>
          <Button className="text-base" variant="outline" onClick={onClose} disabled={busy}>Annuleren</Button>
          <Button className="text-base" onClick={submit} disabled={busy || count === 0 || singleVariant}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {count > 0 ? `${count} koppelen aan offerte` : "Koppelen aan offerte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
