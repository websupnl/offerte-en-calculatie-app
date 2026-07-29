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
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Search,
  FileText,
  TrendingUp,
  FolderKanban,
  User,
  ArrowUpRight,
  Loader2,
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
  customer: { id: string; name: string; email: string | null } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string; status: string } | null;
  items: { id: string }[];
};

type OptionItem = { id: string; name?: string; title?: string; number?: string };

export function CalculationsClient({
  initialCalculations,
  customers,
  projects,
}: {
  initialCalculations: CalculationSummary[];
  customers: OptionItem[];
  projects: OptionItem[];
  companySlug: string;
}) {
  const router = useRouter();
  const [calculations, setCalculations] = useState<CalculationSummary[]>(initialCalculations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [newDialogOpen, setNewDialogOpen] = useState(false);

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

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Weet je zeker dat je deze calculatie wilt verwijderen?")) return;

    try {
      const res = await fetch(`/api/calculations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      setCalculations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Calculatie verwijderd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij verwijderen");
    }
  }

  async function handleDuplicate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

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

      <div className="space-y-6 p-5 lg:p-8">
        {/* KPI Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <span>Calculaties</span>
                <Calculator className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold">{calculations.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <span>Totale Netto Inkoop</span>
                <span className="text-slate-400 text-xs">Excl. BTW</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-700">
                {formatCurrency(totalCostSum)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <span>Totale Verkoopprijs</span>
                <span className="text-slate-400 text-xs">Excl. BTW</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
                {formatCurrency(totalSalesSum)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <span>Totale Brutowinst</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-2xl font-bold tabular-nums text-emerald-600">
                  {formatCurrency(totalMarginSum)}
                </p>
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {avgMarginPercent.toFixed(1)}% marge
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op titel, nummer, klant of project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "ALL")}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle statussen</SelectItem>
                <SelectItem value="DRAFT">Concept</SelectItem>
                <SelectItem value="COMPLETED">Afgerond</SelectItem>
                <SelectItem value="QUOTED">Omgezet naar offerte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List of calculations */}
        {filteredCalculations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-base font-semibold text-slate-800">Geen calculaties gevonden</p>
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
          <div className="space-y-3">
            {filteredCalculations.map((calc) => (
              <Link key={calc.id} href={`/calculations/${calc.id}`} className="block group">
                <Card className="transition-all hover:border-slate-300 hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {calc.number}
                          </span>
                          <h3 className="font-semibold text-slate-900 group-hover:text-[var(--ws-accent)] transition-colors truncate">
                            {calc.title}
                          </h3>
                          <Badge variant={CALCULATION_STATUS_COLORS[calc.status] as "default" | "secondary"}>
                            {CALCULATION_STATUS_LABELS[calc.status] ?? calc.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
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
                              Offerte {calc.quote.number}
                            </span>
                          )}
                          <span>Gewijzigd {formatDate(calc.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Right: Margins & Financials */}
                      <div className="flex items-center gap-6 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 justify-between md:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Netto Inkoop</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-700">
                            {formatCurrency(calc.totalCostPrice)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-500">Verkoop (ex)</p>
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {formatCurrency(calc.totalSalesPrice)}
                          </p>
                        </div>

                        <div className="text-right pl-3 border-l border-slate-200">
                          <p className="text-xs text-emerald-600 font-semibold">Brutowinst</p>
                          <p className="text-sm font-bold tabular-nums text-emerald-600">
                            {formatCurrency(calc.marginAmount)}
                          </p>
                          <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            {calc.marginPercent.toFixed(1)}% marge
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            onClick={(e) => handleDuplicate(calc.id, e)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(calc.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
