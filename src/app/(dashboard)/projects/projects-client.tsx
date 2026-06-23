"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Loader2, FolderKanban, FileText, Paperclip } from "lucide-react";
import { PROJECT_STATUS_LABELS } from "@/lib/format";

const schema = z.object({
  customerId: z.string().min(1, "Kies een klant"),
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Project = {
  id: string;
  number: string;
  title: string;
  status: string;
  city: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  _count: { quotes: number; files: number };
};

export function ProjectsClient({
  initialProjects,
  customers,
}: {
  initialProjects: Project[];
  customers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.number.toLowerCase().includes(search.toLowerCase()) ||
      (p.customer?.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    reset();
    setDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Aanmaken mislukt");
      const project: Project = await res.json();
      setProjects((prev) => [project, ...prev]);
      setDialogOpen(false);
      toast.success(`Project ${project.number} aangemaakt`);
      router.push(`/projects/${project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            Projecten
          </h1>
          <p className="text-muted-foreground text-sm">
            Bundel offertes, werkbonnen, facturen en bestanden per klus.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nieuw project
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op titel, nummer of klant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {projects.length === 0
              ? "Nog geen projecten. Maak je eerste project aan."
              : "Geen projecten gevonden."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{p.number}</span>
                    <Badge variant="secondary">
                      {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold leading-tight">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.customer?.name ?? "Geen klant"}
                    {p.city ? ` · ${p.city}` : ""}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {p._count.quotes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" /> {p._count.files}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Klant *</Label>
              <Select
                onValueChange={(v) => { if (v) setValue("customerId", v); }}
                value={watch("customerId")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kies een klant" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && (
                <p className="text-sm text-destructive">{errors.customerId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input {...register("title")} placeholder="Bijv. Thuisbatterij + laadpaal" />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Omschrijving</Label>
              <Textarea {...register("description")} placeholder="Korte omschrijving (optioneel)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input {...register("address")} placeholder="Straat + nr" />
              </div>
              <div className="space-y-2">
                <Label>Plaats</Label>
                <Input {...register("city")} placeholder="Plaats" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Aanmaken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
