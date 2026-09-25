"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Check, ClipboardList, FileText, Loader2, PenLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { InvoiceLinesEditor, stripKeys, toEditable, type EditableLine } from "@/components/invoices/invoice-lines-editor";

type Customer = { id: string; name: string; city: string | null };
type SourceType = "quote" | "calculation" | "workorder";
type SourceItem = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  amount: number | null;
  customerId: string | null;
  customerName: string | null;
  invoicedAs: string | null;
};
type Sources = { quotes: SourceItem[]; calculations: SourceItem[]; workOrders: SourceItem[] };

const TABS: { key: SourceType | "free"; label: string; hint: string; icon: typeof FileText }[] = [
  { key: "quote", label: "Offerte", hint: "Met de keuze van de klant", icon: FileText },
  { key: "calculation", label: "Calculatie", hint: "Alle zichtbare regels", icon: Calculator },
  { key: "workorder", label: "Werkbon", hint: "Materiaal en uren", icon: ClipboardList },
  { key: "free", label: "Artikelen & vrij", hint: "Zelf samenstellen", icon: PenLine },
];

const STATUS_NL: Record<string, string> = {
  DRAFT: "Concept", SENT: "Verstuurd", VIEWED: "Bekeken", ACCEPTED: "Akkoord", DECLINED: "Afgewezen", EXPIRED: "Verlopen",
  COMPLETED: "Klaar", QUOTED: "In offerte", CONCEPT: "Concept", GEPLAND: "Gepland", UITGEVOERD: "Uitgevoerd", GEFACTUREERD: "Gefactureerd",
};

export function NewInvoiceClient({
  customers,
  initialCustomerId,
  initialSource,
}: {
  customers: Customer[];
  initialCustomerId: string | null;
  initialSource: { type: SourceType; id: string } | null;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [customerQuery, setCustomerQuery] = useState("");
  const [tab, setTab] = useState<SourceType | "free">(initialSource?.type ?? "quote");
  const [sources, setSources] = useState<Sources | null>(null);
  const [source, setSource] = useState<{ type: SourceType; id: string } | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Lijst leegmaken zodat je niet op bronnen van de vorige klant klikt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSources(null);
    fetch(`/api/invoices/sources${customerId ? `?customerId=${customerId}` : ""}`)
      .then((r) => r.json())
      .then(setSources)
      .catch(() => setSources({ quotes: [], calculations: [], workOrders: [] }));
  }, [customerId]);

  const pickSource = useCallback(async (type: SourceType, id: string) => {
    setLoadingSource(true);
    try {
      const res = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) throw new Error("Bron kon niet geladen worden");
      const data = await res.json();
      setSource({ type, id });
      setLines(toEditable(data.lines));
      setReference(data.reference ?? "");
      setProjectId(data.projectId ?? null);
      if (data.customerId) setCustomerId(data.customerId);
      if (data.lines.length === 0) toast.info("Deze bron heeft geen eenmalige regels. Voeg ze zelf toe.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setLoadingSource(false);
    }
  }, []);

  useEffect(() => {
    // Bron uit de URL (knop "Factureren" elders) één keer inladen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialSource) void pickSource(initialSource.type, initialSource.id);
  }, [initialSource, pickSource]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return (q ? customers.filter((c) => `${c.name} ${c.city ?? ""}`.toLowerCase().includes(q)) : customers).slice(0, 8);
  }, [customers, customerQuery]);
  const customer = customers.find((c) => c.id === customerId) ?? null;

  const list: SourceItem[] =
    tab === "quote" ? sources?.quotes ?? [] : tab === "calculation" ? sources?.calculations ?? [] : tab === "workorder" ? sources?.workOrders ?? [] : [];

  async function create() {
    if (!customerId) return toast.error("Kies eerst een klant");
    const clean = stripKeys(lines);
    if (clean.length === 0) return toast.error("Een factuur zonder regels heeft geen zin");
    setCreating(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, projectId, source: source ?? undefined, lines: clean, reference, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Aanmaken mislukt");
      toast.success(`Factuur ${data.number} aangemaakt`);
      router.push(`/invoices/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5 lg:p-8">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Facturen
      </Link>
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ws-accent)]">Nieuwe factuur</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 lg:text-[28px]">Wat ga je factureren?</h1>
        <p className="mt-1 text-sm text-slate-500">Kies een klant en een bron. De regels kun je daarna nog aanpassen, er wordt pas iets opgeslagen als je op aanmaken klikt.</p>
      </div>

      {/* 1. Klant */}
      <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06] sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span>
          <h2 className="font-semibold text-slate-950">Klant</h2>
        </div>
        {customer ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-950">{customer.name}</p>
              {customer.city && <p className="text-xs text-slate-500">{customer.city}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setCustomerId(null); setSource(null); setLines([]); setProjectId(null); }}>
              Wijzigen
            </Button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Zoek klant" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {filteredCustomers.map((c) => (
                <button key={c.id} type="button" onClick={() => setCustomerId(c.id)} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  {c.city && <span className="ml-2 text-xs text-slate-500">{c.city}</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Of kies hieronder direct een offerte, calculatie of werkbon: de klant komt dan mee.</p>
          </div>
        )}
      </section>

      {/* 2. Bron */}
      <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06] sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span>
          <h2 className="font-semibold text-slate-950">Bron</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-start gap-3 rounded-xl p-3 text-left ring-1 transition",
                tab === t.key ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300",
              )}
            >
              <t.icon className={cn("mt-0.5 h-4 w-4 shrink-0", tab === t.key ? "text-[var(--ws-accent)]" : "text-slate-400")} />
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={cn("block text-xs", tab === t.key ? "text-white/60" : "text-slate-500")}>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {tab !== "free" && (
          <div className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-100">
            {sources === null && <p className="p-4 text-sm text-slate-500">Laden…</p>}
            {sources && list.length === 0 && <p className="p-4 text-sm text-slate-500">Niets gevonden{customer ? ` voor ${customer.name}` : ""}.</p>}
            {list.map((s) => {
              const active = source?.type === tab && source.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={loadingSource}
                  onClick={() => pickSource(tab, s.id)}
                  className={cn("flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50", active && "bg-[color-mix(in_srgb,var(--ws-accent)_8%,white)]")}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{s.number}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{STATUS_NL[s.status] ?? s.status}</span>
                      {s.invoicedAs && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Al gefactureerd: {s.invoicedAs}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">{s.title || "Zonder titel"}</span>
                    {!customer && s.customerName && <span className="block truncate text-xs text-slate-500">{s.customerName}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-slate-700">
                    {s.amount !== null && formatCurrency(s.amount)}
                    {active && <Check className="h-4 w-4 text-[var(--ws-accent)]" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Regels */}
      <section className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
        {loadingSource && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
        <InvoiceLinesEditor lines={lines} onChange={setLines} />
      </section>

      <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06] sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <Label>Referentie</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bijv. offertenummer of PO van de klant" />
        </div>
        <div className="space-y-2">
          <Label>Opmerking op de factuur</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optioneel" />
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={create} disabled={creating || !customerId} className="shadow-lg">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Factuur aanmaken
        </Button>
      </div>
    </div>
  );
}
