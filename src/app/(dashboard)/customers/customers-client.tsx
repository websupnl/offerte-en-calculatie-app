"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Loader2, Users, ArrowUpRight } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  email: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  notes: string | null;
  _count: { quotes: number };
};

export function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    reset();
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setValue("name", c.name);
    setValue("email", c.email ?? "");
    setValue("phone", c.phone ?? "");
    setValue("address", c.address ?? "");
    setValue("city", c.city ?? "");
    setValue("zipCode", c.zipCode ?? "");
    setValue("notes", c.notes ?? "");
    setDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      if (editingId) {
        const response = await fetch(`/api/customers/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Bijwerken mislukt");
        setCustomers((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...data } : c))
        );
        toast.success("Klant bijgewerkt");
      } else {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Aanmaken mislukt");
        const created = await res.json();
        setCustomers((prev) => [...prev, { ...created, _count: { quotes: 0 } }]);
        toast.success("Klant aangemaakt");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er is iets misgegaan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) return;
    const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Verwijderen mislukt");
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    toast.success("Klant verwijderd");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Relaties"
        title="Klanten"
        description={`${customers.length} relaties met contactgegevens en offertehistorie.`}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />Nieuwe klant</Button>}
      />
      <div className="space-y-4 p-5 lg:p-8">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op naam of e-mail..."
          className="h-10 bg-white pl-9 shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Geen klanten gevonden</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Voeg eerste klant toe
            </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-4">Naam</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plaats</TableHead>
                <TableHead>Offertes</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open klant ${c.name}`}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/customers/${c.id}`);
                    }
                  }}
                  className="cursor-pointer focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#167f88]"
                >
                  <TableCell className="pl-4 font-semibold">{c.name}</TableCell>
                  <TableCell>
                    <p className="text-sm">{c.email || "—"}</p>
                    <p className="text-xs text-slate-400">{c.phone || "Geen telefoon"}</p>
                  </TableCell>
                  <TableCell className="text-slate-500">{c.city || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c._count.quotes} offerte{c._count.quotes !== 1 ? "s" : ""}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit(c); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={(event) => { event.stopPropagation(); handleDelete(c.id, c.name); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <span className="grid h-8 w-8 place-items-center text-slate-400">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input {...register("name")} placeholder="Bedrijfsnaam of persoonsnaam" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input {...register("email")} type="email" placeholder="info@bedrijf.nl" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefoon</Label>
                <Input {...register("phone")} placeholder="06-12345678" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adres</Label>
              <Input {...register("address")} placeholder="Straatnaam 1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input {...register("zipCode")} placeholder="1234 AB" />
              </div>
              <div className="space-y-2">
                <Label>Plaats</Label>
                <Input {...register("city")} placeholder="Amsterdam" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notities</Label>
              <Textarea {...register("notes")} placeholder="Interne notities..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Opslaan" : "Aanmaken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
