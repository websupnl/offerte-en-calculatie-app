"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Package, Layers, X, Database, ExternalLink, Terminal, Search, Truck, Clock, Copy, Upload, FileText } from "lucide-react";

const BRAVE_CDP_COMMAND = '/snap/bin/brave --remote-debugging-port=9222 --user-data-dir="$HOME/snap/brave/current/.config/BraveSoftware/Brave-Browser" &';
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { KOOLHAAS_CATEGORIES, WEBSUP_CATEGORIES } from "@/lib/format";
import { ArticlePickerDialog } from "@/components/products/article-picker-dialog";
import { SupplierSelect } from "@/components/forms/supplier-select";
import { computeSalesPrice } from "@/lib/pricing";

const productSchema = z.object({
  category: z.string().min(1, "Categorie is verplicht"),
  name: z.string().min(1, "Naam is verplicht"),
  description: z.string().optional(),
  unit: z.string().default("stuk"),
  basePrice: z.number().min(0),
  basePriceAuto: z.boolean().default(true),
  costPrice: z.number().min(0).nullable().optional(),
  defaultMarkupPercent: z.number().min(0).nullable().optional(),
  vatRate: z.number().min(0).max(100).default(21),
  supplier: z.string().optional(),
  sku: z.string().optional(),
  ean: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;
type ProductFormInput = z.input<typeof productSchema>;

type Product = {
  id: string;
  datasheetId?: string | null;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  basePrice: string | number;
  basePriceAuto?: boolean;
  costPrice: string | number | null;
  defaultMarkupPercent?: string | number | null;
  vatRate: string | number;
  supplier?: string | null;
  sku?: string | null;
  ean?: string | null;
  priceUpdatedAt?: string | null;
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

type Datasheet = {
  id: string;
  brand: string;
  model: string;
  category: string | null;
  price: string | number | null;
  notes: string | null;
  sourceUrl: string | null;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    basePrice: string | number;
    costPrice: string | number | null;
  } | null;
};

export function ProductsClient({
  initialProducts,
  initialSets,
  initialDatasheets,
  companySlug,
  initialProductId,
}: {
  initialProducts: Product[];
  initialSets: ProductSet[];
  initialDatasheets: Datasheet[];
  companySlug: string;
  initialProductId?: string;
}) {
  const router = useRouter();
  const initialSelectedProduct = initialProducts.find((product) => product.id === initialProductId);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sets, setSets] = useState<ProductSet[]>(initialSets);
  const [datasheets, setDatasheets] = useState<Datasheet[]>(initialDatasheets);
  const [editingDsId, setEditingDsId] = useState<string | null>(null);
  const [dsPriceEdit, setDsPriceEdit] = useState<string>("");
  const [productDialog, setProductDialog] = useState(Boolean(initialSelectedProduct));
  const [editingId, setEditingId] = useState<string | null>(initialSelectedProduct?.id ?? null);
  const [selectedDatasheetId, setSelectedDatasheetId] = useState<string | null>(
    initialSelectedProduct?.datasheetId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [productDocs, setProductDocs] = useState<{ id: string; name: string; type: string; url: string | null }[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSupplierFilter, setProductSupplierFilter] = useState("all");

  // ProductSet dialog state
  const [setDialog, setSetDialog] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setCategory, setSetCategory] = useState("");
  const [setItems, setSetItems] = useState<SetItemDraft[]>([]);
  const [savingSet, setSavingSet] = useState(false);

  // CLI Runner state
  const [cliDialogOpen, setCliDialogOpen] = useState(false);
  const [cliSupplier, setCliSupplier] = useState("oosterberg");
  const [cliQuery, setCliQuery] = useState("sigenergy");
  const [cliRunning, setCliRunning] = useState(false);
  const [cliLogs, setCliLogs] = useState("");

  async function runCliScraper() {
    setCliRunning(true);
    setCliLogs(`▶ Gestart: CLI Scraper voor ${cliSupplier} (zoekterm: '${cliQuery}')\n--------------------------------------------------\n`);

    try {
      const res = await fetch("/api/cli/run-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier: cliSupplier, query: cliQuery }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Kan CLI proces niet starten");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        setCliLogs((prev) => prev + text);
      }
    } catch (err) {
      setCliLogs((prev) => prev + `\n✖ Fout: ${err instanceof Error ? err.message : "Fout"}\n`);
    } finally {
      setCliRunning(false);
      router.refresh();
    }
  }

  const categories =
    companySlug === "koolhaas"
      ? [...KOOLHAAS_CATEGORIES]
      : [...WEBSUP_CATEGORIES];

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<ProductFormInput, unknown, ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: initialSelectedProduct
      ? {
          category: initialSelectedProduct.category,
          name: initialSelectedProduct.name,
          description: initialSelectedProduct.description ?? "",
          unit: initialSelectedProduct.unit,
          basePrice: Number(initialSelectedProduct.basePrice),
          basePriceAuto: initialSelectedProduct.basePriceAuto ?? true,
          costPrice: initialSelectedProduct.costPrice == null ? null : Number(initialSelectedProduct.costPrice),
          defaultMarkupPercent: initialSelectedProduct.defaultMarkupPercent != null ? Number(initialSelectedProduct.defaultMarkupPercent) : 25,
          vatRate: Number(initialSelectedProduct.vatRate),
          supplier: initialSelectedProduct.supplier ?? "",
          sku: initialSelectedProduct.sku ?? "",
          ean: initialSelectedProduct.ean ?? "",
        }
      : { vatRate: 21, unit: "stuk", basePriceAuto: true, defaultMarkupPercent: 25 },
  });

  const watchedCostPrice = watch("costPrice");
  const watchedMarkup = watch("defaultMarkupPercent");
  const watchedBasePriceAuto = watch("basePriceAuto");

  useEffect(() => {
    if (watchedBasePriceAuto) {
      setValue("basePrice", computeSalesPrice(watchedCostPrice ?? 0, watchedMarkup ?? 0));
    }
  }, [watchedBasePriceAuto, watchedCostPrice, watchedMarkup, setValue]);

  const pickerProducts = products.map((p) => ({
    ...p,
    basePrice: Number(p.basePrice),
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
  }));

  const productSuppliers = [...new Set(products.map((p) => p.supplier).filter((s): s is string => Boolean(s)))].sort();

  const filteredProducts = products.filter((p) => {
    if (productSupplierFilter !== "all" && p.supplier !== productSupplierFilter) return false;
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.ean ?? "").toLowerCase().includes(q) ||
      (p.supplier ?? "").toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const allCategories = [
    ...categories,
    ...products.map((product) => product.category).filter((category) => !(categories as string[]).includes(category)),
  ];
  const grouped = [...new Set(allCategories)].map((cat) => ({
    name: cat,
    products: filteredProducts.filter((p) => p.category === cat),
  })).filter((g) => g.products.length > 0);

  function openCreate() {
    reset({ vatRate: 21, unit: "stuk", basePriceAuto: true, defaultMarkupPercent: 25, basePrice: 0 });
    setEditingId(null);
    setSelectedDatasheetId(null);
    setProductDocs([]);
    setProductDialog(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setValue("category", p.category);
    setValue("name", p.name);
    setValue("description", p.description ?? "");
    setValue("unit", p.unit);
    setValue("costPrice", p.costPrice ? Number(p.costPrice) : null);
    setValue("defaultMarkupPercent", p.defaultMarkupPercent != null ? Number(p.defaultMarkupPercent) : 25);
    setValue("basePriceAuto", p.basePriceAuto ?? true);
    setValue("basePrice", Number(p.basePrice));
    setValue("vatRate", Number(p.vatRate));
    setValue("supplier", p.supplier ?? "");
    setValue("sku", p.sku ?? "");
    setValue("ean", p.ean ?? "");
    setSelectedDatasheetId(p.datasheetId ?? null);
    setProductDialog(true);
    void loadProductDocs(p.id);
  }

  async function loadProductDocs(productId: string) {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/documents`);
      const data = await res.json();
      if (res.ok) setProductDocs(data);
    } finally {
      setDocsLoading(false);
    }
  }

  async function uploadProductDoc(file: File) {
    if (!editingId) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "DATASHEET");
      const res = await fetch(`/api/products/${editingId}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uploaden mislukt");
      setProductDocs((prev) => [data, ...prev]);
      toast.success("Datasheet geüpload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploaden mislukt");
    } finally {
      setDocUploading(false);
    }
  }

  async function deleteProductDoc(docId: string) {
    if (!editingId) return;
    setProductDocs((prev) => prev.filter((d) => d.id !== docId));
    await fetch(`/api/products/${editingId}/documents/${docId}`, { method: "DELETE" });
  }

  function openCreateFromDatasheet(datasheet: Datasheet) {
    const costPrice = Number(datasheet.price ?? 0);
    reset({
      category: datasheet.category || "Overig",
      name: `${datasheet.brand} ${datasheet.model}`,
      description: datasheet.notes ?? "",
      unit: "stuk",
      basePriceAuto: true,
      defaultMarkupPercent: 25,
      basePrice: computeSalesPrice(costPrice, 25),
      costPrice,
      vatRate: 21,
    });
    setEditingId(null);
    setSelectedDatasheetId(datasheet.id);
    setProductDialog(true);
  }

  async function onSubmit(data: ProductForm) {
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, datasheetId: selectedDatasheetId }),
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.error || "Bijwerken mislukt");
        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? updated : p))
        );
        setDatasheets((prev) =>
          prev.map((datasheet) => ({
            ...datasheet,
            product:
              datasheet.id === selectedDatasheetId
                ? {
                    id: updated.id,
                    name: updated.name,
                    basePrice: updated.basePrice,
                    costPrice: updated.costPrice,
                  }
                : datasheet.product?.id === updated.id
                  ? null
                  : datasheet.product,
          })),
        );
        toast.success("Product bijgewerkt");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, datasheetId: selectedDatasheetId }),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || "Aanmaken mislukt");
        setProducts((prev) => [...prev, created]);
        if (selectedDatasheetId) {
          setDatasheets((prev) =>
            prev.map((datasheet) =>
              datasheet.id === selectedDatasheetId
                ? {
                    ...datasheet,
                    product: {
                      id: created.id,
                      name: created.name,
                      basePrice: created.basePrice,
                      costPrice: created.costPrice,
                    },
                  }
                : datasheet,
            ),
          );
        }
        toast.success("Product aangemaakt");
      }
      setProductDialog(false);
      setSelectedDatasheetId(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er is iets misgegaan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) return;
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Product verwijderen mislukt");
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
        if (!res.ok) throw new Error(updated.error || "Set bijwerken mislukt");
        setSets((prev) => prev.map((s) => (s.id === editingSetId ? updated : s)));
        toast.success("Set bijgewerkt");
      } else {
        const res = await fetch("/api/product-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || "Set aanmaken mislukt");
        setSets((prev) => [...prev, created]);
        toast.success("Set aangemaakt");
      }
      setSetDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er is iets misgegaan");
    } finally {
      setSavingSet(false);
    }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm("Weet je zeker dat je deze set wilt verwijderen?")) return;
    const response = await fetch(`/api/product-sets/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Set verwijderen mislukt");
    setSets((prev) => prev.filter((s) => s.id !== id));
    toast.success("Set verwijderd");
  }

  async function handleSaveDsPrice(id: string) {
    const price = parseFloat(dsPriceEdit);
    if (isNaN(price)) { toast.error("Voer een geldige prijs in"); return; }
    const response = await fetch(`/api/knowledge/datasheets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    if (!response.ok) return toast.error("Inkoopprijs bijwerken mislukt");
    setDatasheets((prev) => prev.map((d) => d.id === id ? { ...d, price } : d));
    setProducts((prev) =>
      prev.map((product) =>
        product.datasheetId === id ? { ...product, costPrice: price } : product,
      ),
    );
    setEditingDsId(null);
    toast.success("Inkoopprijs bijgewerkt");
  }

  async function handleDeleteDs(id: string) {
    if (!confirm("Datasheet-entry verwijderen?")) return;
    const response = await fetch(`/api/knowledge/datasheets/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Entry verwijderen mislukt");
    setDatasheets((prev) => prev.filter((d) => d.id !== id));
    toast.success("Entry verwijderd");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogus"
        title="Artikelen & prijzen"
        description={`${products.length} artikelen · ${sets.length} sets · ${datasheets.length} leveranciersprijzen`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCliDialogOpen(true)}>
              <Terminal className="mr-2 h-4 w-4 text-emerald-600" />
              Sync Leverancier (CLI)
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuw artikel
            </Button>
          </div>
        }
      />
      <div className="space-y-6 p-5 lg:p-8">
      <Tabs defaultValue="products">
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            Artikelen ({products.length})
          </TabsTrigger>
          <TabsTrigger value="sets">
            <Layers className="mr-2 h-4 w-4" />
            Artikelsets ({sets.length})
          </TabsTrigger>
          <TabsTrigger value="inkoopprijzen">
            <Database className="mr-2 h-4 w-4" />
            Inkoopprijzen ({datasheets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {products.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Zoek op naam, omschrijving, EAN, artikelcode of leverancier..."
                  className="pl-8 bg-white"
                />
              </div>
              {productSuppliers.length > 0 && (
                <Select value={productSupplierFilter} onValueChange={(v) => setProductSupplierFilter(v || "all")}>
                  <SelectTrigger className="w-[190px] bg-white shrink-0">
                    <Truck className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                    <SelectValue placeholder="Leverancier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle leveranciers</SelectItem>
                    {productSuppliers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span className="text-xs text-muted-foreground self-center shrink-0">
                {filteredProducts.length} van {products.length} artikelen
              </span>
            </div>
          )}
          {products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nog geen artikelen</p>
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  Voeg eerste artikel toe
                </Button>
              </CardContent>
            </Card>
          ) : filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Geen artikelen gevonden</p>
                <p className="text-xs text-muted-foreground mt-1">Pas je zoekterm of leverancier-filter aan.</p>
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
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(p)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openEdit(p);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between px-6 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ws-accent)]"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {p.supplier && (
                              <Badge className="text-[10px] py-0 px-1.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-100">
                                <Truck className="mr-1 h-2.5 w-2.5" />
                                {p.supplier}
                              </Badge>
                            )}
                            {p.datasheetId && <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">Leveranciersprijs gekoppeld</Badge>}
                            {p.sku && <span className="text-[10px] text-muted-foreground font-mono">Art# {p.sku}</span>}
                            {p.ean && <span className="text-[10px] text-muted-foreground font-mono">EAN {p.ean}</span>}
                            {p.priceUpdatedAt && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                prijs {formatRelativeDate(p.priceUpdatedAt)}
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{p.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(Number(p.basePrice))}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.costPrice != null ? `inkoop ${formatCurrency(Number(p.costPrice))} · ` : ""}per {p.unit} · {p.vatRate}% BTW
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit(p); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={(event) => { event.stopPropagation(); handleDelete(p.id); }}
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
              <Card
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditSet(s)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEditSet(s);
                  }
                }}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-accent)]"
              >
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
                      <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEditSet(s); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(event) => { event.stopPropagation(); handleDeleteSet(s.id); }}
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

        <TabsContent value="inkoopprijzen" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leveranciersinkoopprijzen gescrapet via <code className="text-xs bg-muted px-1 rounded">npm run scrape:oosterberg</code>
            </p>
          </div>
          {datasheets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nog geen inkoopprijzen</p>
                <p className="text-xs text-muted-foreground mt-1">Voer <code>npm run scrape:oosterberg</code> uit om Sigenergy-prijzen op te halen</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {datasheets.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{d.brand} {d.model}</p>
                          {d.category && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{d.category}</span>}
                        </div>
                        {d.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {editingDsId === d.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={dsPriceEdit}
                              onChange={(e) => setDsPriceEdit(e.target.value)}
                              className="w-28 h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveDsPrice(d.id); if (e.key === "Escape") setEditingDsId(null); }}
                            />
                            <Button size="sm" onClick={() => handleSaveDsPrice(d.id)}>Opslaan</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingDsId(null)}>Annuleren</Button>
                          </div>
                        ) : (
                          <>
                            <div className="text-right">
                              <p className="text-sm font-medium tabular-nums">
                                {d.price != null ? formatCurrency(Number(d.price)) : <span className="text-muted-foreground text-xs">—</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">inkoop excl. btw</p>
                            </div>
                            {d.product ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/products?product=${d.product!.id}`)}
                              >
                                {d.product.name}
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => openCreateFromDatasheet(d)}>
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Maak artikel
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditingDsId(d.id); setDsPriceEdit(d.price != null ? String(d.price) : ""); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {d.sourceUrl && (
                              <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                              </a>
                            )}
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteDs(d.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      </div>
      {/* Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Artikel bewerken" : "Nieuw artikel"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Categorie *</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                <Label>Inkoop (ex)</Label>
                <Input
                  {...register("costPrice", {
                    setValueAs: (value) => value === "" ? null : Number(value),
                  })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Opslag %</Label>
                <Input
                  {...register("defaultMarkupPercent", {
                    setValueAs: (value) => value === "" ? null : Number(value),
                  })}
                  type="number"
                  step="0.5"
                  placeholder="25"
                />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Verkoop (ex)</Label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setValue("basePriceAuto", !watchedBasePriceAuto)}
                >
                  {watchedBasePriceAuto ? "Handmatig aanpassen" : "Automatisch berekenen"}
                </button>
              </div>
              <Input
                {...register("basePrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="0.00"
                disabled={watchedBasePriceAuto}
                className={watchedBasePriceAuto ? "bg-slate-50 text-slate-500" : ""}
              />
              {watchedBasePriceAuto && (
                <p className="text-[11px] text-slate-400">Automatisch berekend: inkoop × (1 + opslag%)</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Leverancier</Label>
                <Controller
                  name="supplier"
                  control={control}
                  render={({ field }) => (
                    <SupplierSelect
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      extraSuppliers={products.map((p) => p.supplier)}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Artikelcode</Label>
                <Input {...register("sku")} placeholder="Leveranciers-SKU" />
              </div>
              <div className="space-y-2">
                <Label>EAN</Label>
                <Input {...register("ean")} placeholder="8712345678901" />
              </div>
            </div>

            {editingId && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Datasheets & brochures</Label>
                  <label
                    className={`inline-flex h-7 cursor-pointer items-center rounded-md border px-2 text-xs font-medium hover:bg-slate-50 ${docUploading ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {docUploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                    Uploaden
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="sr-only"
                      disabled={docUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadProductDoc(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {docsLoading ? (
                  <p className="text-xs text-slate-400">Laden...</p>
                ) : productDocs.length === 0 ? (
                  <p className="text-xs text-slate-400">Nog geen bestanden geüpload.</p>
                ) : (
                  <div className="space-y-1">
                    {productDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                        <span className="flex items-center gap-1.5 min-w-0 text-xs">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{doc.name}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <Button type="button" size="icon" variant="ghost" className="h-6 w-6">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          )}
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteProductDoc(doc.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    <ArticlePickerDialog
                      products={pickerProducts}
                      onSelect={(sel) => updateSetItem(idx, "productId", sel.id)}
                      title="Artikel kiezen voor set"
                      trigger={
                        <Button type="button" variant="outline" className="flex-1 justify-start font-normal min-w-0">
                          <Search className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {item.productId
                              ? products.find((p) => p.id === item.productId)?.name ?? "Onbekend artikel"
                              : "Selecteer artikel..."}
                          </span>
                        </Button>
                      }
                    />
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

      {/* CLI Scraper Runner Dialog */}
      <Dialog open={cliDialogOpen} onOpenChange={setCliDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-600" />
              CLI Scraper Uitvoeren (Realtime Output)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-800">Vereist: Brave open met CDP-debugging</p>
                <code className="block truncate text-[11px] text-amber-700">{BRAVE_CDP_COMMAND}</code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 bg-white"
                onClick={() => {
                  navigator.clipboard.writeText(BRAVE_CDP_COMMAND);
                  toast.success("Commando gekopieerd");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Kopieer
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leverancier</Label>
                <Select value={cliSupplier} onValueChange={(val) => setCliSupplier(val || "oosterberg")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecteer leverancier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oosterberg">Oosterberg (Webshop / Brave CDP)</SelectItem>
                    <SelectItem value="rexel">Rexel (Netto inkoopprijzen)</SelectItem>
                    <SelectItem value="estg">ESTG (Zonnepanelen & Batterijen)</SelectItem>
                    <SelectItem value="4blue">4Blue (Solar & Montage)</SelectItem>
                    <SelectItem value="elektramat">Elektramat (publieke prijs, vergelijking)</SelectItem>
                    <SelectItem value="technim">Technim (publieke prijs, vergelijking)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Zoekterm / Categorie</Label>
                <Input
                  value={cliQuery}
                  onChange={(e) => setCliQuery(e.target.value)}
                  placeholder="Bijv. sigenergy, huawei, abb, eaton..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Terminal Stdout / Stderr Output</Label>
                {cliRunning && (
                  <span className="text-xs text-emerald-600 font-mono animate-pulse flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Process actief...
                  </span>
                )}
              </div>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto whitespace-pre-wrap break-all shadow-inner border border-slate-800">
                {cliLogs || "// Klik op 'Start CLI Process' om de scraper lokaal uit te voeren..."}
              </pre>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCliDialogOpen(false)} disabled={cliRunning}>
              Sluiten
            </Button>
            <Button onClick={runCliScraper} disabled={cliRunning} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {cliRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
              Start CLI Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
