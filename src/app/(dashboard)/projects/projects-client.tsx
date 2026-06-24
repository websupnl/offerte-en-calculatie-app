"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Loader2, FolderKanban, FileText, Paperclip, ArrowUpRight } from "lucide-react";
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
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: "" },
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) =>
      !query ||
      project.title.toLowerCase().includes(query) ||
      project.number.toLowerCase().includes(query) ||
      project.customer?.name.toLowerCase().includes(query),
    );
  }, [projects, search]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Aanmaken mislukt");
      setProjects((current) => [body, ...current]);
      setDialogOpen(false);
      reset();
      toast.success(`Project ${body.number} aangemaakt`);
      router.push(`/projects/${body.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Werk"
        title="Projecten"
        description="Het centrale dossier voor offertes, werkbonnen, facturen en bestanden."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nieuw project
          </Button>
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Zoek project, nummer of klant…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 bg-white pl-9 shadow-sm"
          />
        </div>
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="grid min-h-72 place-items-center text-center text-slate-500">
              <div><FolderKanban className="mx-auto mb-3 h-10 w-10 text-slate-300" />Geen projecten gevonden.</div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">Project</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dossier</TableHead>
                  <TableHead>Plaats</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="pl-4">
                      <Link href={`/projects/${project.id}`}>
                        <p className="font-semibold">{project.title}</p>
                        <p className="font-mono text-xs text-slate-400">{project.number}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{project.customer?.name ?? "Geen klant"}</TableCell>
                    <TableCell><Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{project._count.quotes}</span>
                        <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{project._count.files}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{project.city || "—"}</TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuw project</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Klant *</Label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value || "")}>
                    <SelectTrigger><SelectValue placeholder="Kies een klant" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input {...register("title")} placeholder="Bijv. Thuisbatterij + laadpaal" />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2"><Label>Omschrijving</Label><Textarea {...register("description")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Adres</Label><Input {...register("address")} /></div>
              <div className="space-y-2"><Label>Plaats</Label><Input {...register("city")} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Aanmaken</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
