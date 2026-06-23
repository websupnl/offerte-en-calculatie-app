"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_FILE_CATEGORIES,
  WORKORDER_STATUS_LABELS,
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
    if (!confirm("Bestand verwijderen?")) return;
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
    </div>
  );
}
