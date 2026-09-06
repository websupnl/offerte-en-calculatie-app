"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm-provider";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Paperclip,
  Upload,
  Loader2,
  Trash2,
  Download,
  FolderKanban,
  ClipboardList,
  Receipt,
  ShoppingCart,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_FILE_CATEGORIES,
  WORKORDER_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
  formatCurrency,
  formatDate,
  QUOTE_STATUS_LABELS,
} from "@/lib/format";

type ProjectFile = {
  id: string;
  name: string;
  objectKey: string;
  mimeType: string | null;
  size: number | null;
  category: string | null;
  uploadedAt: string;
  url?: string | null;
};

type Quote = {
  id: string;
  number: string;
  status: string;
  totalIncVat: string | number;
  createdAt: string;
};

type WorkOrder = {
  id: string;
  number: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  _count: { lines: number };
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalIncVat: string | number;
  invoiceDate: string;
  createdAt: string;
};

type PurchaseInvoice = {
  id: string;
  supplierName: string;
  invoiceNumber: string | null;
  amount: string | number;
  vatAmount: string | number | null;
  status: string;
  invoiceDate: string | null;
  fileName: string | null;
  createdAt: string;
};

type Project = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  address: string | null;
  city: string | null;
  customer: { id: string; name: string; email: string | null } | null;
  quotes: Quote[];
  files: ProjectFile[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
};

const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"];

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectDetailClient({ project }: { project: Project }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [status, setStatus] = useState(project.status);
  const [files, setFiles] = useState<ProjectFile[]>(project.files);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("OVERIG");
  const fileInput = useRef<HTMLInputElement>(null);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(project.workOrders);
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [woSaving, setWoSaving] = useState(false);
  const { register: woRegister, handleSubmit: woHandleSubmit, reset: woReset } =
    useForm<{ title: string; description?: string; technicianName?: string }>();

  async function createWorkOrder(data: {
    title: string;
    description?: string;
    technicianName?: string;
  }) {
    setWoSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/workorders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Aanmaken mislukt");
      const wo: WorkOrder = await res.json();
      setWorkOrders((prev) => [wo, ...prev]);
      setWoDialogOpen(false);
      woReset();
      toast.success(`Werkbon ${wo.number} aangemaakt`);
      router.push(`/workorders/${wo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setWoSaving(false);
    }
  }

  const [invoices, setInvoices] = useState<Invoice[]>(project.invoices);
  const [invCreating, setInvCreating] = useState(false);

  async function createInvoice(payload: { fromQuoteId?: string; fromWorkOrderId?: string }) {
    setInvCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Aanmaken mislukt");
      const inv: Invoice = await res.json();
      setInvoices((prev) => [inv, ...prev]);
      toast.success(`Factuur ${inv.number} aangemaakt`);
      router.push(`/invoices/${inv.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setInvCreating(false);
    }
  }

  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(project.purchaseInvoices);
  const [purDialogOpen, setPurDialogOpen] = useState(false);
  const [purSaving, setPurSaving] = useState(false);
  const purFileInput = useRef<HTMLInputElement>(null);

  async function createPurchase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("supplierName") ?? "").trim()) {
      toast.error("Vul de leverancier in");
      return;
    }
    setPurSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/purchase-invoices`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Opslaan mislukt");
      }
      const pur: PurchaseInvoice = await res.json();
      setPurchases((prev) => [pur, ...prev]);
      setPurDialogOpen(false);
      toast.success("Inkoopfactuur toegevoegd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setPurSaving(false);
    }
  }

  // Margecijfers: verkoop (incl. btw) minus inkoop (excl. btw).
  const salesTotal = invoices.reduce((s, i) => s + Number(i.totalIncVat), 0);
  const purchaseTotal = purchases.reduce((s, p) => s + Number(p.amount), 0);

  async function changeStatus(next: string) {
    const prev = status;
    setStatus(next);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Status bijgewerkt");
    } catch {
      setStatus(prev);
      toast.error("Status bijwerken mislukt");
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", uploadCategory);
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload mislukt");
      }
      const saved: ProjectFile = await res.json();
      setFiles((prev) => [saved, ...prev]);
      toast.success("Bestand geüpload");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload mislukt");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function deleteFile(fileId: string) {
    if (!(await confirm({ title: "Bestand verwijderen?", confirmLabel: "Verwijderen", destructive: true }))) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("Bestand verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar projecten
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{project.number}</span>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            {project.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {project.customer?.name ?? "Geen klant"}
            {project.city ? ` · ${project.address ? project.address + ", " : ""}${project.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => { if (v) changeStatus(v); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1">
            <FileText className="h-4 w-4" /> Offertes ({project.quotes.length})
          </TabsTrigger>
          <TabsTrigger value="workorders" className="gap-1">
            <ClipboardList className="h-4 w-4" /> Werkbonnen ({workOrders.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1">
            <Receipt className="h-4 w-4" /> Facturen ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1">
            <ShoppingCart className="h-4 w-4" /> Inkoop ({purchases.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1">
            <Paperclip className="h-4 w-4" /> Bestanden ({files.length})
          </TabsTrigger>
        </TabsList>

        {/* Overzicht */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="secondary">{PROJECT_STATUS_LABELS[status]}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Klant</p>
                  <p className="font-medium">{project.customer?.name ?? "—"}</p>
                </div>
                {project.address && (
                  <div>
                    <p className="text-muted-foreground">Adres</p>
                    <p className="font-medium">{project.address}, {project.city}</p>
                  </div>
                )}
              </div>
              {project.description && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Omschrijving</p>
                  <p className="whitespace-pre-wrap">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offertes */}
        <TabsContent value="quotes" className="mt-4 space-y-3">
          {project.quotes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nog geen offertes gekoppeld aan dit project.
              </CardContent>
            </Card>
          ) : (
            project.quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{q.number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                      <span className="font-medium">{formatCurrency(q.totalIncVat)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Werkbonnen */}
        <TabsContent value="workorders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { woReset(); setWoDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nieuwe werkbon
            </Button>
          </div>
          {workOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nog geen werkbonnen. Maak er een aan voor de uitvoering.
              </CardContent>
            </Card>
          ) : (
            workOrders.map((w) => (
              <Link key={w.id} href={`/workorders/${w.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{w.number}</p>
                      <p className="font-medium truncate">{w.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {w._count.lines} regel{w._count.lines === 1 ? "" : "s"}
                        {w.scheduledAt ? ` · gepland ${formatDate(w.scheduledAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">
                        {WORKORDER_STATUS_LABELS[w.status] ?? w.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Facturen */}
        <TabsContent value="invoices" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={invCreating}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {invCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Factuur maken
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => createInvoice({})}>
                  Lege factuur
                </DropdownMenuItem>
                {project.quotes
                  .filter((q) => q.status === "ACCEPTED")
                  .map((q) => (
                    <DropdownMenuItem
                      key={q.id}
                      onClick={() => createInvoice({ fromQuoteId: q.id })}
                    >
                      Vanuit offerte {q.number}
                    </DropdownMenuItem>
                  ))}
                {workOrders
                  .filter((w) => w.status === "UITGEVOERD")
                  .map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onClick={() => createInvoice({ fromWorkOrderId: w.id })}
                    >
                      Vanuit werkbon {w.number}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nog geen facturen. Maak er een vanuit een offerte, werkbon of leeg.
              </CardContent>
            </Card>
          ) : (
            invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.invoiceDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                      <span className="font-medium">{formatCurrency(inv.totalIncVat)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Inkoop */}
        <TabsContent value="purchases" className="mt-4 space-y-3">
          <Card>
            <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Verkoop (incl.)</p>
                <p className="font-semibold">{formatCurrency(salesTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inkoop (excl.)</p>
                <p className="font-semibold">{formatCurrency(purchaseTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verschil</p>
                <p className="font-semibold">{formatCurrency(salesTotal - purchaseTotal)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPurDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Inkoopfactuur
            </Button>
          </div>

          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nog geen inkoopfacturen. Voeg bonnetjes toe voor margeinzicht.
              </CardContent>
            </Card>
          ) : (
            purchases.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.invoiceNumber ? `${p.invoiceNumber} · ` : ""}
                      {p.invoiceDate ? formatDate(p.invoiceDate) : "geen datum"}
                      {p.fileName ? ` · 📎 ${p.fileName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary">
                      {PURCHASE_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Bestanden */}
        <TabsContent value="files" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={uploadCategory} onValueChange={(v) => { if (v) setUploadCategory(v); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_FILE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={onFilePicked}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Bestand uploaden
            </Button>
          </div>

          {files.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nog geen bestanden. Upload offertes, werkbonnen of foto&apos;s.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <Card key={f.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.category} · {formatSize(f.size)} · {formatDate(f.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFile(f.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={woDialogOpen} onOpenChange={setWoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe werkbon</DialogTitle>
          </DialogHeader>
          <form onSubmit={woHandleSubmit(createWorkOrder)} className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input
                {...woRegister("title", { required: true })}
                placeholder="Bijv. Plaatsing batterij + inbedrijfstelling"
              />
            </div>
            <div className="space-y-2">
              <Label>Omschrijving</Label>
              <Textarea {...woRegister("description")} placeholder="Wat ga je doen? (optioneel)" />
            </div>
            <div className="space-y-2">
              <Label>Monteur</Label>
              <Input {...woRegister("technicianName")} placeholder="Naam monteur (optioneel)" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWoDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={woSaving}>
                {woSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Aanmaken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={purDialogOpen} onOpenChange={setPurDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inkoopfactuur toevoegen</DialogTitle>
          </DialogHeader>
          <form onSubmit={createPurchase} className="space-y-4">
            <div className="space-y-2">
              <Label>Leverancier *</Label>
              <Input name="supplierName" placeholder="Bijv. Oosterberg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Factuurnummer</Label>
                <Input name="invoiceNumber" placeholder="Optioneel" />
              </div>
              <div className="space-y-2">
                <Label>Factuurdatum</Label>
                <Input name="invoiceDate" type="date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bedrag (excl. btw)</Label>
                <Input name="amount" type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Btw-bedrag</Label>
                <Input name="vatAmount" type="number" step="0.01" placeholder="optioneel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bon / scan (foto)</Label>
              <Input ref={purFileInput} name="file" type="file" accept="image/*,application/pdf" />
            </div>
            <div className="space-y-2">
              <Label>Notitie</Label>
              <Textarea name="notes" placeholder="Optioneel" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPurDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={purSaving}>
                {purSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Toevoegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
