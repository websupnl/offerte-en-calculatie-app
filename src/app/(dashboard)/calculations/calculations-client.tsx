"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/confirm-provider";
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Search,
  FileText,
  FolderKanban,
  User,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  Loader2,
  MoreVertical,
  Trash2,
  Copy,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  CALCULATION_STATUS_LABELS,
  CALCULATION_STATUS_COLORS,
} from "@/lib/format";

type CalculationSummary = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "COMPLETED" | "QUOTED";
  totalCostPrice: number;
  totalSalesPrice: number;
  marginAmount: number;
  marginPercent: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  customer: { id: string; name: string; email: string | null } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string | null; status: string } | null;
};

type OptionItem = { id: string; name?: string; title?: string; number?: string };

export function CalculationsClient({
  initialCalculations,
  customers,
  projects,
  showArchived = false,
}: {
  initialCalculations: CalculationSummary[];
  customers: OptionItem[];
  projects: OptionItem[];
  companySlug: string;
  showArchived?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [calculations, setCalculations] = useState<CalculationSummary[]>(initialCalculations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "archive" | "restore" | "delete") {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete") {
      const ok = await confirm({
        title: `${ids.length} calculatie${ids.length === 1 ? "" : "s"} verwijderen?`,
        body: "Definitief. Archiveren houdt ze bewaard en uit de lijst.",
        confirmLabel: "Verwijderen",
        destructive: true,
      });
      if (!ok) return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/calculations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulkactie mislukt");
      setCalculations((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
      const verb = action === "archive" ? "gearchiveerd" : action === "restore" ? "teruggezet" : "verwijderd";
      toast.success(`${data.affected} calculatie${data.affected === 1 ? "" : "s"} ${verb}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBulkBusy(false);
    }
  }

  // Form State
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const filteredCalculations = calculations.filter((calc) => {
    const matchesSearch =
      calc.title.toLowerCase().includes(search.toLowerCase()) ||
      calc.number.toLowerCase().includes(search.toLowerCase()) ||
      (calc.customer?.name && calc.customer.name.toLowerCase().includes(search.toLowerCase())) ||
      (calc.project?.title && calc.project.title.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || calc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCostSum = calculations.reduce((acc, c) => acc + c.totalCostPrice, 0);
  const totalSalesSum = calculations.reduce((acc, c) => acc + c.totalSalesPrice, 0);
  const totalMarginSum = totalSalesSum - totalCostSum;
  const avgMarginPercent = totalSalesSum > 0 ? (totalMarginSum / totalSalesSum) * 100 : 0;

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Voer een titel in");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          customerId: customerId || null,
          projectId: projectId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Aanmaken mislukt");

      toast.success("Calculatie aangemaakt");
      setNewDialogOpen(false);
      router.push(`/calculations/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er is iets misgegaan");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Calculatie verwijderen?",
      body: "De calculatie wordt definitief verwijderd. Archiveren houdt hem bewaard en uit de lijst.",
      confirmLabel: "Verwijderen",
      destructive: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/calculations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      setCalculations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Calculatie verwijderd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij verwijderen");
    }
  }

  async function handleArchive(id: string, archived: boolean) {
    try {
      const res = await fetch(`/api/calculations/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Mislukt");
      setCalculations((prev) => prev.filter((c) => c.id !== id));
      toast.success(archived ? "Calculatie gearchiveerd" : "Calculatie teruggezet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/calculations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dupliceren mislukt");
      toast.success(`Calculatie gedupliceerd als ${data.number}`);
      router.push(`/calculations/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij dupliceren");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Calculaties"
        title="Project & Kostprijs Calculaties"
        description="Gedetailleerde kostprijsberekening op basis van netto inkoop, uren en winstmarges"
        actions={
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe calculatie
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-5 lg:px-8 lg:py-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-base" aria-label="Calculatieoverzicht">
          <span><strong className="tabular-nums">{calculations.length}</strong> <span className="text-muted-foreground">calculaties</span></span>
          <span><span className="text-muted-foreground">Inkoop</span> <strong className="tabular-nums">{formatCurrency(totalCostSum)}</strong></span>
          <span><span className="text-muted-foreground">Verkoop</span> <strong className="tabular-nums">{formatCurrency(totalSalesSum)}</strong></span>
          <span><span className="text-muted-foreground">Brutowinst</span> <strong className="tabular-nums">{formatCurrency(totalMarginSum)}</strong> <span className="text-muted-foreground">({avgMarginPercent.toFixed(1)}%)</span></span>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op titel, nummer, klant of project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val || "ALL")}
              disabled={showArchived}
            >
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle statussen</SelectItem>
                <SelectItem value="DRAFT">Concept</SelectItem>
                <SelectItem value="COMPLETED">Afgerond</SelectItem>
                <SelectItem value="QUOTED">Omgezet naar offerte</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => router.push(showArchived ? "/calculations" : "/calculations?archived=1")}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archief
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-white"
                checked={filteredCalculations.length > 0 && filteredCalculations.every((c) => selected.has(c.id))}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filteredCalculations.map((c) => c.id)) : new Set())
                }
              />
              <span className="font-semibold">{selected.size} geselecteerd</span>
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {showArchived ? (
                <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("restore")}>
                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("archive")}>
                  <Archive className="h-4 w-4" /> Archiveren
                </Button>
              )}
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => runBulk("delete")}>
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setSelected(new Set())}
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {/* List of calculations */}
        {filteredCalculations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-base font-semibold text-foreground">Geen calculaties gevonden</p>
              <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">
                {search || statusFilter !== "ALL"
                  ? "Geen resultaten gevonden voor je huidige zoekfilters."
                  : "Maak een eerste calculatie aan om inkoop- en verkoopmarge vooraf te berekenen."}
              </p>
              <Button onClick={() => setNewDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe calculatie
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {filteredCalculations.map((calc) => (
              <div key={calc.id} className={`group px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4 ${selected.has(calc.id) ? "bg-[var(--ws-accent-soft)]" : ""}`}>
                    <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 md:flex md:items-center md:justify-between md:gap-4">
                      <input
                        type="checkbox"
                        aria-label={`Selecteer ${calc.number}`}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--ws-accent)] md:mt-0"
                        checked={selected.has(calc.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleOne(calc.id);
                        }}
                      />
                      {/* Left: Info */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold text-muted-foreground">
                            {calc.number}
                          </span>
                          <Link href={`/calculations/${calc.id}`} className="min-w-0 truncate font-semibold text-foreground hover:text-[var(--ws-accent)] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{calc.title}</Link>
                          <Badge variant={CALCULATION_STATUS_COLORS[calc.status] as "default" | "secondary"}>
                            {CALCULATION_STATUS_LABELS[calc.status] ?? calc.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {calc.customer && (
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              {calc.customer.name}
                            </span>
                          )}
                          {calc.project && (
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <FolderKanban className="h-3.5 w-3.5 text-slate-400" />
                              {calc.project.number} — {calc.project.title}
                            </span>
                          )}
                          {calc.quote && (
                            <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <FileText className="h-3.5 w-3.5 text-emerald-600" />
                              Offerte {calc.quote.number ?? "zonder nummer"}
                            </span>
                          )}
                          <span>Gewijzigd {formatDate(calc.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Right: Margins & Financials */}
                      <div className="col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-2 md:justify-end md:gap-5 md:border-t-0 md:pt-0">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Netto inkoop</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-700">
                            {formatCurrency(calc.totalCostPrice)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Verkoop excl.</p>
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {formatCurrency(calc.totalSalesPrice)}
                          </p>
                        </div>

                        <div className="border-l border-border pl-3 text-right">
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Brutowinst</p>
                          <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(calc.marginAmount)}
                          </p>
                          <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            {calc.marginPercent.toFixed(1)}% marge
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label="Acties"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem onClick={() => router.push(`/calculations/${calc.id}`)}>
                                <ArrowUpRight className="h-4 w-4" /> Openen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(calc.id)}>
                                <Copy className="h-4 w-4" /> Dupliceren
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {calc.archivedAt ? (
                                <DropdownMenuItem onClick={() => handleArchive(calc.id, false)}>
                                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleArchive(calc.id, true)}>
                                  <Archive className="h-4 w-4" /> Archiveren
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(calc.id)}>
                                <Trash2 className="h-4 w-4" /> Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Calculation Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nieuwe Calculatie Aanmaken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titel van de calculatie *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Zonnepanelen + Thuisbatterij Fam. Jansen"
              />
            </div>

            <div className="space-y-2">
              <Label>Koppel aan Klant (optioneel)</Label>
              <Select value={customerId} onValueChange={(val) => setCustomerId(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een klant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Geen klant —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Koppel aan Project (optioneel)</Label>
              <Select value={projectId} onValueChange={(val) => setProjectId(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Geen project —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aanmaken & Openen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
