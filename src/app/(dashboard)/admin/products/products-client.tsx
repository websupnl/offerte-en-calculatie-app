"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Package, Layers, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { KOOLHAAS_CATEGORIES, WEBSUP_CATEGORIES } from "@/lib/format";

const productSchema = z.object({
  category: z.string().min(1, "Categorie is verplicht"),
  name: z.string().min(1, "Naam is verplicht"),
  description: z.string().optional(),
  unit: z.string().default("stuk"),
  basePrice: z.number().min(0),
  costPrice: z.number().min(0).optional().nullable(),
  vatRate: z.number().default(21),
});

type ProductForm = z.infer<typeof productSchema>;

type Product = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  basePrice: string | number;
  costPrice: string | number | null;
  vatRate: string | number;
};

type ProductSetItem = {
  id: string;
  productId: string;
  qty: string | number;
  notes: string | null;
  sortOrder: number;
  product: Product;
};

type ProductSet = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  items: ProductSetItem[];
};

type SetItemDraft = {
  productId: string;
  qty: number;
  notes: string;
};

export function ProductsClient({
  initialProducts,
  initialSets,
  companySlug,
}: {
  initialProducts: Product[];
  initialSets: ProductSet[];
  companySlug: string;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sets, setSets] = useState<ProductSet[]>(initialSets);
  const [productDialog, setProductDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ProductSet dialog state
  const [setDialog, setSetDialog] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setCategory, setSetCategory] = useState("");
  const [setItems, setSetItems] = useState<SetItemDraft[]>([]);
  const [savingSet, setSavingSet] = useState(false);

  const categories =
    companySlug === "koolhaas"
      ? [...KOOLHAAS_CATEGORIES]
      : [...WEBSUP_CATEGORIES];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: { vatRate: 21, unit: "stuk" },
  });

  const grouped = categories.map((cat) => ({
    name: cat,
    products: products.filter((p) => p.category === cat),
  })).filter((g) => g.products.length > 0);

  function openCreate() {
    reset({ vatRate: 21, unit: "stuk" });
    setEditingId(null);
    setProductDialog(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setValue("category", p.category);
    setValue("name", p.name);
    setValue("description", p.description ?? "");
    setValue("unit", p.unit);
    setValue("basePrice", Number(p.basePrice));
    setValue("costPrice", p.costPrice ? Number(p.costPrice) : null);
    setValue("vatRate", Number(p.vatRate));
    setProductDialog(true);
  }

  async function onSubmit(data: ProductForm) {
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...data } : p))
        );
        toast.success("Product bijgewerkt");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const created = await res.json();
        setProducts((prev) => [...prev, created]);
        toast.success("Product aangemaakt");
      }
      setProductDialog(false);
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Product verwijderd");
  }

  function openCreateSet() {
    setEditingSetId(null);
    setSetName("");
    setSetDescription("");
    setSetCategory("");
    setSetItems([{ productId: "", qty: 1, notes: "" }]);
    setSetDialog(true);
  }

  function openEditSet(s: ProductSet) {
    setEditingSetId(s.id);
    setSetName(s.name);
    setSetDescription(s.description ?? "");
    setSetCategory(s.category ?? "");
    setSetItems(
      s.items.map((item) => ({
        productId: item.productId,
        qty: Number(item.qty),
        notes: item.notes ?? "",
      }))
    );
    setSetDialog(true);
  }

  function addSetItem() {
    setSetItems((prev) => [...prev, { productId: "", qty: 1, notes: "" }]);
  }

  function removeSetItem(idx: number) {
    setSetItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSetItem(idx: number, field: keyof SetItemDraft, value: string | number) {
    setSetItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  async function saveSet() {
    if (!setName.trim()) { toast.error("Naam is verplicht"); return; }
    const validItems = setItems.filter((i) => i.productId && i.qty > 0);
    if (validItems.length === 0) { toast.error("Voeg minimaal één product toe"); return; }

    setSavingSet(true);
    try {
      const payload = {
        name: setName,
        description: setDescription || undefined,
        category: setCategory || undefined,
        items: validItems.map((item, idx) => ({
          productId: item.productId,
          qty: item.qty,
          notes: item.notes || undefined,
          sortOrder: idx,
        })),
      };

      if (editingSetId) {
        const res = await fetch(`/api/product-sets/${editingSetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated = await res.json();
        setSets((prev) => prev.map((s) => (s.id === editingSetId ? updated : s)));
        toast.success("Set bijgewerkt");
      } else {
        const res = await fetch("/api/product-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        setSets((prev) => [...prev, created]);
        toast.success("Set aangemaakt");
      }
      setSetDialog(false);
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSavingSet(false);
    }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm("Weet je zeker dat je deze set wilt verwijderen?")) return;
    await fetch(`/api/product-sets/${id}`, { method: "DELETE" });
    setSets((prev) => prev.filter((s) => s.id !== id));
    toast.success("Set verwijderd");
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Producten & Diensten</h1>
          <p className="text-muted-foreground">{products.length} producten, {sets.length} sets</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuw product
        </Button>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            Producten ({products.length})
          </TabsTrigger>
          <TabsTrigger value="sets">
            <Layers className="mr-2 h-4 w-4" />
            Sets ({sets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nog geen producten</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  Voeg eerste product toe
                </Button>
              </CardContent>
            </Card>
          ) : (
            grouped.map((group) => (
              <Card key={group.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(Number(p.basePrice))}</p>
                            <p className="text-xs text-muted-foreground">per {p.unit} · {p.vatRate}% BTW</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sets" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateSet}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe set
            </Button>
          </div>
          {sets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nog geen productsets</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Productsets zijn vooraf samengestelde combinaties (bijv. &quot;Thuisbatterij Starter 5kWh&quot;)
                </p>
              </CardContent>
            </Card>
          ) : (
            sets.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.items.length} items</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditSet(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSet(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {s.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-6 py-2.5">
                        <span className="text-sm">{item.product.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">×{Number(item.qty)}</span>
                          <span className="text-sm">
                            {formatCurrency(Number(item.product.basePrice) * Number(item.qty))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-3 border-t flex justify-between">
                    <span className="text-sm font-medium">Totaal (excl. BTW)</span>
                    <span className="text-sm font-bold">
                      {formatCurrency(
                        s.items.reduce(
                          (acc, item) => acc + Number(item.product.basePrice) * Number(item.qty),
                          0
                        )
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Product bewerken" : "Nieuw product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Categorie *</Label>
              <Select
                onValueChange={(v) => { if (v) setValue("category", v); }}
                defaultValue={watch("category")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer categorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input {...register("name")} placeholder="Productnaam" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Omschrijving</Label>
              <Textarea {...register("description")} rows={2} placeholder="Korte productomschrijving..." />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Verkoop (ex)</Label>
                <Input {...register("basePrice", { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Inkoop (ex)</Label>
                <Input {...register("costPrice", { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>BTW %</Label>
                <Input {...register("vatRate", { valueAsNumber: true })} type="number" placeholder="21" />
              </div>
              <div className="space-y-2">
                <Label>Eenheid</Label>
                <Input {...register("unit")} placeholder="stuk" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialog(false)}>
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

      {/* ProductSet Dialog */}
      <Dialog open={setDialog} onOpenChange={setSetDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSetId ? "Set bewerken" : "Nieuwe productset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Naam *</Label>
                <Input
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="Bijv. Thuisbatterij Starter 5kWh"
                />
              </div>
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select onValueChange={(v) => { if (v) setSetCategory(v); }} value={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optioneel" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Omschrijving</Label>
              <Textarea
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                rows={2}
                placeholder="Korte omschrijving van de set..."
              />
            </div>

            <div className="space-y-2">
              <Label>Producten in set *</Label>
              <div className="space-y-2">
                {setItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      onValueChange={(v) => { if (v) updateSetItem(idx, "productId", v); }}
                      value={item.productId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecteer product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => updateSetItem(idx, "qty", parseFloat(e.target.value) || 1)}
                      className="w-20"
                      placeholder="Qty"
                    />
                    <Input
                      value={item.notes}
                      onChange={(e) => updateSetItem(idx, "notes", e.target.value)}
                      className="w-32"
                      placeholder="Notitie"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSetItem(idx)}
                      disabled={setItems.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSetItem}>
                <Plus className="mr-2 h-4 w-4" />
                Product toevoegen
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setSetDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={saveSet} disabled={savingSet}>
              {savingSet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSetId ? "Opslaan" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
