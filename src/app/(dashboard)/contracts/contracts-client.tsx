"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileSignature, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CONTRACT_PERIOD_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS,
  formatCurrency, formatDate,
} from "@/lib/format";

type Contract = {
  id: string; number: string; title: string; status: string;
  startDate: string | null; endDate: string | null;
  recurringAmount: string | number | null; recurringPeriod: string | null;
  signedAt: string | null;
  customer: { id: string; name: string } | null;
  project: { id: string; number: string; title: string } | null;
};

export function ContractsClient({
  initialContracts,
  customers,
  projects,
}: {
  initialContracts: Contract[];
  customers: { id: string; name: string }[];
  projects: { id: string; number: string; title: string }[];
}) {
  const [contracts, setContracts] = useState(initialContracts);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter(
      (contract) =>
        contract.title.toLowerCase().includes(query) ||
        contract.number.toLowerCase().includes(query) ||
        contract.customer?.name.toLowerCase().includes(query),
    );
  }, [contracts, search]);

  // Terugkerende omzet: alleen uit contracten die daadwerkelijk lopen.
  const mrr = useMemo(
    () =>
      contracts
        .filter((contract) => ["GETEKEND", "ACTIEF"].includes(contract.status) && contract.recurringAmount)
        .reduce((sum, contract) => {
          const amount = Number(contract.recurringAmount);
          const perMonth =
            contract.recurringPeriod === "YEAR" ? amount / 12 :
            contract.recurringPeriod === "QUARTER" ? amount / 3 : amount;
          return sum + perMonth;
        }, 0),
    [contracts],
  );

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Contracten"
        description={
          mrr > 0
            ? `Lopende afspraken. ${formatCurrency(mrr)} terugkerend per maand.`
            : "Onderhoudscontracten, hosting, service-afspraken."
        }
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nieuw contract</Button>}
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoeken"
            className="pl-9"
            aria-label="Contracten zoeken"
          />
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
          {filtered.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center text-sm text-slate-400">
              <div>
                <FileSignature className="mx-auto mb-2 h-8 w-8" />
                {search ? "Niets gevonden." : "Nog geen contracten."}
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {filtered.map((contract) => (
                  <Link key={contract.id} href={`/contracts/${contract.id}`} className="block p-4 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{contract.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{contract.number} · {contract.customer?.name}</p>
                      </div>
                      <Badge variant={CONTRACT_STATUS_COLORS[contract.status] ?? "outline"}>
                        {CONTRACT_STATUS_LABELS[contract.status]}
                      </Badge>
                    </div>
                    {contract.recurringAmount && (
                      <p className="mt-2 text-sm font-bold tabular-nums">
                        {formatCurrency(Number(contract.recurringAmount))}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          {contract.recurringPeriod ? CONTRACT_PERIOD_LABELS[contract.recurringPeriod] : ""}
                        </span>
                      </p>
                    )}
                  </Link>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="pl-4">Contract</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Loopt tot</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="pl-4">
                          <p className="max-w-72 truncate font-semibold">{contract.title}</p>
                          <p className="text-xs text-slate-400">{contract.number}</p>
                        </TableCell>
                        <TableCell className="font-medium">{contract.customer?.name}</TableCell>
                        <TableCell>
                          <Badge variant={CONTRACT_STATUS_COLORS[contract.status] ?? "outline"}>
                            {CONTRACT_STATUS_LABELS[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {contract.endDate ? formatDate(contract.endDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {contract.recurringAmount ? (
                            <>
                              {formatCurrency(Number(contract.recurringAmount))}
                              <span className="block text-[11px] font-normal text-slate-400">
                                {contract.recurringPeriod ? CONTRACT_PERIOD_LABELS[contract.recurringPeriod] : ""}
                              </span>
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/contracts/${contract.id}`} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100">
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      <NewContractDialog
        open={open}
        onOpenChange={setOpen}
        customers={customers}
        projects={projects}
        onCreated={(contract) => setContracts((current) => [contract, ...current])}
      />
    </div>
  );
}

function NewContractDialog({
  open,
  onOpenChange,
  customers,
  projects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: { id: string; name: string }[];
  projects: { id: string; number: string; title: string }[];
  onCreated: (contract: Contract) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("MONTH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noticeDays, setNoticeDays] = useState("30");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!customerId || !title.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          projectId: projectId === "none" ? null : projectId,
          title: title.trim(),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          noticePeriodDays: noticeDays ? Number(noticeDays) : null,
          recurringAmount: amount ? Number(amount) : null,
          recurringPeriod: amount ? period : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Aanmaken mislukt");
      onCreated(body);
      onOpenChange(false);
      setCustomerId(""); setTitle(""); setAmount(""); setStartDate(""); setEndDate("");
      toast.success("Contract aangemaakt — schrijf nu de tekst");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aanmaken mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nieuw contract</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Klant</Label>
            <Select value={customerId} onValueChange={(value) => setCustomerId(value ?? "")}>
              <SelectTrigger><SelectValue placeholder="Kies een klant" /></SelectTrigger>
              <SelectContent>
                {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract-title">Titel</Label>
            <Input
              id="contract-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Onderhoudscontract website"
            />
          </div>

          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(value) => setProjectId(value ?? "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.number} · {project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-amount">Bedrag</Label>
              <Input
                id="contract-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Periode</Label>
              <Select value={period} onValueChange={(value) => setPeriod(value ?? "MONTH")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTH">Per maand</SelectItem>
                  <SelectItem value="QUARTER">Per kwartaal</SelectItem>
                  <SelectItem value="YEAR">Per jaar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-start">Ingangsdatum</Label>
              <Input id="contract-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-end">Loopt tot</Label>
              <Input id="contract-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract-notice">Opzegtermijn (dagen)</Label>
            <Input
              id="contract-notice"
              type="number"
              value={noticeDays}
              onChange={(event) => setNoticeDays(event.target.value)}
            />
            <p className="text-xs text-slate-400">
              Je krijgt automatisch een taak zodra je erover moet nadenken.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={saving || !customerId || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
