"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ArticlePickerDialog, type ArticlePickerProduct } from "@/components/products/article-picker-dialog";
import { SearchablePopoverSelect } from "@/components/forms/searchable-popover-select";
import { SupplierSelect } from "@/components/forms/supplier-select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calculator,
  Plus,
  Save,
  FileText,
  Trash2,
  Clock,
  Layers,
  Wand2,
  TrendingUp,
  Loader2,
  Percent,
  CheckCircle2,
  MapPin,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  formatCurrency,
  CALCULATION_STATUS_LABELS,
  CALCULATION_STATUS_COLORS,
} from "@/lib/format";
import { estimateTravelDistanceKm, getTravelPrice, type TravelPricingTier } from "@/lib/travel";

type ProductOption = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  unit: string;
  basePrice: number;
  costPrice: number | null;
  defaultMarkupPercent: number;
  supplier: string | null;
  sku: string | null;
  ean?: string | null;
  priceUpdatedAt?: string | null;
  vatRate: number;
};

type ProductSetOption = {
  id: string;
  name: string;
  description: string | null;
  laborHours: number;
  laborRate: number;
  items: {
    id: string;
    qty: number;
    product: ProductOption;
  }[];
};

type CalculationItemState = {
  id?: string;
  productId?: string | null;
  type: "MATERIAL" | "LABOR" | "CUSTOM" | "SET";
  supplier?: string | null;
  sku?: string | null;
  description: string;
  qty: number;
  unit: string;
  costPrice: number;
  markupPercent: number;
  unitPrice: number;
  totalCostPrice: number;
  totalSalesPrice: number;
  vatRate: number;
  optional: boolean;
  hiddenOnQuote: boolean;
};

type CalculationDetail = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "COMPLETED" | "QUOTED";
  vatRate: number;
  totalCostPrice: number;
  totalSalesPrice: number;
  marginAmount: number;
  marginPercent: number;
  notes: string | null;
  customerId: string | null;
  projectId: string | null;
  quoteId: string | null;
  customer: { id: string; name: string } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string; status: string } | null;
  items: CalculationItemState[];
};

export function CalculationBuilderClient({
  initialCalculation,
  products: initialProducts,
  customers,
  projects,
  sets,
  homeBaseZipCode,
  travelPricingTiers,
}: {
  initialCalculation: CalculationDetail;
  products: ProductOption[];
  customers: { id: string; name: string; zipCode?: string | null }[];
  projects: { id: string; number: string; title: string }[];
  sets: ProductSetOption[];
  homeBaseZipCode?: string;
  travelPricingTiers?: TravelPricingTier[];
}) {
  const router = useRouter();
  const [calculation, setCalculation] = useState<CalculationDetail>(initialCalculation);
  const [items, setItems] = useState<CalculationItemState[]>(initialCalculation.items);
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);

  // Quick-create artikel dialog (voor artikelen die nog niet in de catalogus staan)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);
  const [quickCreate, setQuickCreate] = useState({
    name: "",
    category: "Overig",
    unit: "stuk",
    costPrice: 0,
    basePrice: 0,
    supplier: "",
    sku: "",
    ean: "",
  });

  function openQuickCreate(query: string) {
    setQuickCreate({
      name: query,
      category: "Overig",
      unit: "stuk",
      costPrice: 0,
      basePrice: 0,
      supplier: "",
      sku: "",
      ean: "",
    });
    setQuickCreateOpen(true);
  }

  async function handleQuickCreate() {
    if (!quickCreate.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    setQuickCreateSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: quickCreate.category || "Overig",
          name: quickCreate.name,
          unit: quickCreate.unit || "stuk",
          basePrice: quickCreate.basePrice,
          costPrice: quickCreate.costPrice,
          supplier: quickCreate.supplier || null,
          sku: quickCreate.sku || null,
          ean: quickCreate.ean || null,
          vatRate: 21,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Aanmaken mislukt");

      const newProduct: ProductOption = {
        ...created,
        basePrice: Number(created.basePrice),
        costPrice: created.costPrice != null ? Number(created.costPrice) : null,
        defaultMarkupPercent: created.defaultMarkupPercent ? Number(created.defaultMarkupPercent) : 25,
        vatRate: Number(created.vatRate),
      };

      setProducts((prev) => [...prev, newProduct]);
      addItemFromProduct(newProduct);
      setQuickCreateOpen(false);
      toast.success(`Artikel "${newProduct.name}" aangemaakt en toegevoegd`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij aanmaken artikel");
    } finally {
      setQuickCreateSaving(false);
    }
  }

  // Form Header State
  const [title, setTitle] = useState(initialCalculation.title);
  const [description, setDescription] = useState(initialCalculation.description ?? "");
  const [notes, setNotes] = useState(initialCalculation.notes ?? "");
  const [customerId, setCustomerId] = useState(initialCalculation.customerId ?? "");
  const [projectId, setProjectId] = useState(initialCalculation.projectId ?? "");
  const [status, setStatus] = useState(initialCalculation.status);

  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Set / Combi Selector Dialog
  const [setDialogOpen, setSetDialogOpen] = useState(false);

  // Bulk Markup Dialog
  const [bulkMarkupOpen, setBulkMarkupOpen] = useState(false);
  const [bulkMarkupPercent, setBulkMarkupPercent] = useState<number>(25);

  // Realtime Calculated Totals
  const totals = useMemo(() => {
    let totalCost = 0;
    let totalSales = 0;
    let totalVat = 0;
    let optionalSales = 0;

    items.forEach((item) => {
      if (item.optional) {
        optionalSales += item.qty * item.unitPrice;
        return;
      }
      totalCost += item.qty * item.costPrice;
      totalSales += item.qty * item.unitPrice;
      totalVat += item.qty * item.unitPrice * (item.vatRate / 100);
    });

    const margin = totalSales - totalCost;
    const marginPct = totalSales > 0 ? (margin / totalSales) * 100 : 0;

    return {
      totalCost,
      totalSales,
      totalVat,
      optionalSales,
      totalSalesIncVat: totalSales + totalVat,
      margin,
      marginPct,
    };
  }, [items]);

  // Helper to update a single item property and recalculate prices
  function updateItem(index: number, field: keyof CalculationItemState, val: any) {
    setItems((prev) => {
      const copy = [...prev];
      const current = { ...copy[index], [field]: val };

      // Recalculate cost, markup or unitPrice based on edited field
      if (field === "costPrice" || field === "markupPercent" || field === "qty") {
        const cost = field === "costPrice" ? parseFloat(val) || 0 : current.costPrice;
        const markup = field === "markupPercent" ? parseFloat(val) || 0 : current.markupPercent;
        current.unitPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;
      } else if (field === "unitPrice") {
        const unitP = parseFloat(val) || 0;
        if (current.costPrice > 0) {
          current.markupPercent = Math.round(((unitP - current.costPrice) / current.costPrice) * 1000) / 10;
        }
      }

      current.totalCostPrice = current.qty * current.costPrice;
      current.totalSalesPrice = current.qty * current.unitPrice;

      copy[index] = current;
      return copy;
    });
  }

  function addItemFromProduct(p: ProductOption) {
    const costPrice = p.costPrice != null ? p.costPrice : p.basePrice;
    const markupPercent = p.defaultMarkupPercent ?? 25;
    const unitPrice = Math.round(costPrice * (1 + markupPercent / 100) * 100) / 100;

    const newItem: CalculationItemState = {
      productId: p.id,
      type: "MATERIAL",
      supplier: p.supplier,
      sku: p.sku,
      description: p.name,
      qty: 1,
      unit: p.unit || "stuk",
      costPrice,
      markupPercent,
      unitPrice,
      totalCostPrice: costPrice,
      totalSalesPrice: unitPrice,
      vatRate: p.vatRate || 21,
      optional: false,
      hiddenOnQuote: false,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`${p.name} toegevoegd`);
  }

  function addLaborLine() {
    const newItem: CalculationItemState = {
      type: "LABOR",
      description: "Arbeidsuren installatie / montage",
      qty: 4,
      unit: "uur",
      costPrice: 45, // Netto kostprijs uur
      markupPercent: 44.4, // Opslag naar € 65 verkoop
      unitPrice: 65,
      totalCostPrice: 180,
      totalSalesPrice: 260,
      vatRate: 21,
      optional: false,
      hiddenOnQuote: false,
    };

    setItems((prev) => [...prev, newItem]);
  }

  function addCustomLine() {
    const newItem: CalculationItemState = {
      type: "CUSTOM",
      description: "Nieuwe post / stelpost",
      qty: 1,
      unit: "post",
      costPrice: 100,
      markupPercent: 25,
      unitPrice: 125,
      totalCostPrice: 100,
      totalSalesPrice: 125,
      vatRate: 21,
      optional: false,
      hiddenOnQuote: false,
    };

    setItems((prev) => [...prev, newItem]);
  }

  function addTravelLine() {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer?.zipCode) {
      toast.error("Deze klant heeft geen postcode, vul die eerst aan bij de klantgegevens");
      return;
    }
    if (!homeBaseZipCode) {
      toast.error("Stel eerst je vertrekpostcode in bij Instellingen > Voorrijkosten");
      return;
    }
    const distanceKm = estimateTravelDistanceKm(homeBaseZipCode, customer.zipCode);
    if (distanceKm === null) {
      toast.error("Kon de afstand niet bepalen op basis van deze postcodes");
      return;
    }
    const price = getTravelPrice(distanceKm, travelPricingTiers);
    if (price === null) {
      toast.error("Geen voorrijkosten-schijven ingesteld bij Instellingen > Voorrijkosten");
      return;
    }
    const newItem: CalculationItemState = {
      type: "CUSTOM",
      description: `Voorrijkosten (± ${Math.round(distanceKm)} km enkele reis)`,
      qty: 1,
      unit: "post",
      costPrice: price,
      markupPercent: 0,
      unitPrice: price,
      totalCostPrice: price,
      totalSalesPrice: price,
      vatRate: 21,
      optional: false,
      hiddenOnQuote: false,
    };
    setItems((prev) => [...prev, newItem]);
    toast.success(`Reiskosten toegevoegd: ± ${Math.round(distanceKm)} km, € ${price}`);
  }

  function addProductSet(setOption: ProductSetOption) {
    const newItems: CalculationItemState[] = [];

    // Add material items from set
    setOption.items.forEach((item) => {
      const p = item.product;
      const costPrice = p.costPrice != null ? p.costPrice : p.basePrice;
      const markupPercent = p.defaultMarkupPercent ?? 25;
      const unitPrice = Math.round(costPrice * (1 + markupPercent / 100) * 100) / 100;

      newItems.push({
        productId: p.id,
        type: "SET",
        supplier: p.supplier,
        sku: p.sku,
        description: p.name,
        qty: item.qty,
        unit: p.unit || "stuk",
        costPrice,
        markupPercent,
        unitPrice,
        totalCostPrice: item.qty * costPrice,
        totalSalesPrice: item.qty * unitPrice,
        vatRate: p.vatRate || 21,
        optional: false,
        hiddenOnQuote: false,
      });
    });

    // Add labor hours from set if specified
    if (setOption.laborHours > 0) {
      const laborCost = 45; // default kostprijs per uur
      const laborSales = setOption.laborRate || 65;
      const laborMarkup = Math.round(((laborSales - laborCost) / laborCost) * 1000) / 10;

      newItems.push({
        type: "LABOR",
        description: `Montage & installatie (${setOption.name})`,
        qty: setOption.laborHours,
        unit: "uur",
        costPrice: laborCost,
        markupPercent: laborMarkup,
        unitPrice: laborSales,
        totalCostPrice: setOption.laborHours * laborCost,
        totalSalesPrice: setOption.laborHours * laborSales,
        vatRate: 21,
        optional: false,
        hiddenOnQuote: false,
      });
    }

    setItems((prev) => [...prev, ...newItems]);
    setSetDialogOpen(false);
    toast.success(`Set "${setOption.name}" ingeladen (${newItems.length} regels)`);
  }

  function applyBulkMarkup() {
    setItems((prev) =>
      prev.map((item) => {
        const unitPrice = Math.round(item.costPrice * (1 + bulkMarkupPercent / 100) * 100) / 100;
        return {
          ...item,
          markupPercent: bulkMarkupPercent,
          unitPrice,
          totalSalesPrice: item.qty * unitPrice,
        };
      }),
    );
    setBulkMarkupOpen(false);
    toast.success(`Alle opslagpercentages ingesteld op ${bulkMarkupPercent}%`);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Titel is verplicht");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/calculations/${calculation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status,
          notes,
          customerId: customerId || null,
          projectId: projectId || null,
          items,
        }),
      });

      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Opslaan mislukt");

      setCalculation(updated);
      toast.success("Calculatie opgeslagen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToQuote() {
    if (!customerId) {
      toast.error("Koppel eerst een klant aan deze calculatie om een offerte aan te maken");
      return;
    }

    setConverting(true);
    try {
      // First save latest calculation state
      await handleSave();

      const res = await fetch(`/api/calculations/${calculation.id}/convert-to-quote`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Omzetten naar offerte mislukt");

      toast.success("Offerte succesvol aangemaakt!");
      router.push(`/quotes/${data.quote.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er is iets misgegaan bij het omzetten");
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je deze calculatie wilt verwijderen? Dit kan niet ongedaan gemaakt worden.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/calculations/${calculation.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      toast.success("Calculatie verwijderd");
      router.push("/calculations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij verwijderen");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Calculatie ${calculation.number}`}
        title={title || "Naamloze calculatie"}
        description="Kostprijsberekening op basis van netto inkoop en winstmarges"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/calculations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar overzicht
              </Button>
            </Link>

            <Button onClick={handleSave} disabled={saving} variant="secondary">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Opslaan
            </Button>

            <Button onClick={handleConvertToQuote} disabled={converting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {converting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Omzetten naar Offerte
            </Button>

            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Calculatie verwijderen"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
        {/* Live Margin Header Dashboard */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="bg-slate-900 text-white shadow-md">
            <CardContent className="p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Totale Netto Inkoop
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-200">
                {formatCurrency(totals.totalCost)}
              </p>
              <span className="text-[11px] text-slate-400">Excl. BTW (materiaal + arbeid)</span>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white shadow-md">
            <CardContent className="p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Totale Verkoopprijs
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-400">
                {formatCurrency(totals.totalSales)}
              </p>
              <span className="text-[11px] text-slate-400">Excl. BTW (voorgesteld aan klant)</span>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-300">
                {formatCurrency(totals.totalSalesIncVat)} <span className="text-[11px] font-normal text-slate-500">incl. BTW</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Brutowinst (€)
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-400">
                {formatCurrency(totals.margin)}
              </p>
              <span className="text-[11px] text-emerald-300 font-medium">Verkoop min netto inkoop</span>
            </CardContent>
          </Card>

          <Card className="bg-emerald-950 text-white border-emerald-800 shadow-md">
            <CardContent className="p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Brutomarge (%)
              </span>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-emerald-300">
                {totals.marginPct.toFixed(1)}%
              </p>
              <span className="text-[11px] text-emerald-400">Winstmarge percentage</span>
            </CardContent>
          </Card>
        </div>

        {/* Calculation Settings Header */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Calculatie Gegevens & Koppeling</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Titel calculatie *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Klant</Label>
                <SearchablePopoverSelect
                  items={customers}
                  value={customerId}
                  onChange={setCustomerId}
                  getId={(c) => c.id}
                  getLabel={(c) => c.name}
                  placeholder="Selecteer klant..."
                  searchPlaceholder="Zoek klant..."
                  emptyLabel="Geen klant gevonden"
                  clearLabel="— Geen klant —"
                />
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                <SearchablePopoverSelect
                  items={projects}
                  value={projectId}
                  onChange={setProjectId}
                  getId={(p) => p.id}
                  getLabel={(p) => p.title}
                  getSublabel={(p) => p.number}
                  placeholder="Selecteer project..."
                  searchPlaceholder="Zoek project..."
                  emptyLabel="Geen project gevonden"
                  clearLabel="— Geen project —"
                />
              </div>
            </div>

            {calculation.quote && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Deze calculatie is gekoppeld aan Offerte {calculation.quote.number}
                </span>
                <Link href={`/quotes/${calculation.quote.id}`}>
                  <Button variant="outline" size="sm">Bekijk Offerte</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculation Items Section */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Calculatieregels ({items.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stel per regel de netto inkoopprijs en opslag % in voor automatische verkoopprijsberekening.
              </p>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <ArticlePickerDialog
                products={products}
                onSelect={(p) => addItemFromProduct(p as ProductOption)}
                onCreateNew={openQuickCreate}
                title="Artikel toevoegen aan calculatie"
                trigger={
                  <Button variant="default" size="sm">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Artikel toevoegen
                  </Button>
                }
              />

              <Button variant="outline" size="sm" onClick={() => setSetDialogOpen(true)}>
                <Layers className="mr-1.5 h-4 w-4 text-indigo-600" />
                Set / Combi inladen
              </Button>

              <Button variant="outline" size="sm" onClick={addLaborLine}>
                <Clock className="mr-1.5 h-4 w-4 text-amber-600" />
                Uren toevoegen
              </Button>

              <Button variant="outline" size="sm" onClick={addCustomLine}>
                <Plus className="mr-1.5 h-4 w-4" />
                Vrije regel
              </Button>

              <Button variant="outline" size="sm" onClick={addTravelLine}>
                <MapPin className="mr-1.5 h-4 w-4 text-rose-600" />
                Reiskosten
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setBulkMarkupOpen(true)}>
                <Percent className="mr-1.5 h-4 w-4 text-emerald-600" />
                Marge instellen
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">Nog geen calculatieregels</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Voeg artikelen toe uit de catalogus, laad een complete set in of voeg vrije uren toe.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 w-16 text-center" title="Optionele regels tellen niet mee in het hoofdtotaal">Optie</th>
                    <th className="py-2.5 px-3 w-16 text-center" title="Regel wel laten meetellen, maar niet aan de klant tonen">Offerte</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Omschrijving</th>
                    <th className="py-2.5 px-3 w-20">Aantal</th>
                    <th className="py-2.5 px-3 w-20">Eenheid</th>
                    <th className="py-2.5 px-3 w-28 text-right">Netto Inkoop (€)</th>
                    <th className="py-2.5 px-3 w-[104px] text-right">Opslag %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Verkoop (€)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Totaal Netto</th>
                    <th className="py-2.5 px-3 w-28 text-right">Totaal Verkoop</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${item.optional ? "bg-amber-50/60" : ""}`}>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                      {/* Optional toggle */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.optional}
                          onChange={(e) => updateItem(idx, "optional", e.target.checked)}
                          className="h-4 w-4 accent-amber-600"
                          title="Optioneel: telt niet mee in het hoofdtotaal"
                        />
                      </td>

                      {/* Quote visibility toggle */}
                      <td className="py-2 px-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${item.hiddenOnQuote ? "text-slate-400" : "text-emerald-600"}`}
                          onClick={() => updateItem(idx, "hiddenOnQuote", !item.hiddenOnQuote)}
                          title={item.hiddenOnQuote ? "Verborgen op offerte — klik om te tonen" : "Zichtbaar op offerte — klik om te verbergen"}
                          aria-label={item.hiddenOnQuote ? "Regel tonen op offerte" : "Regel verbergen op offerte"}
                        >
                          {item.hiddenOnQuote ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </td>

                      {/* Description */}
                      <td className="py-2 px-3">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                        {item.supplier && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal bg-slate-50">
                              {item.supplier}
                            </Badge>
                            {item.sku && <span className="text-[10px] text-slate-400 font-mono">Art# {item.sku}</span>}
                          </div>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, "qty", e.target.value)}
                          className="h-8 text-xs bg-white text-center tabular-nums"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-3">
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          className="h-8 text-xs bg-white text-center"
                        />
                      </td>

                      {/* Cost Price */}
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPrice}
                          onChange={(e) => updateItem(idx, "costPrice", e.target.value)}
                          className="h-8 text-xs bg-white text-right tabular-nums font-medium"
                        />
                      </td>

                      {/* Markup % */}
                      <td className="py-2 px-3">
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.markupPercent}
                            onChange={(e) => updateItem(idx, "markupPercent", e.target.value)}
                            className="h-8 min-w-[76px] text-xs bg-white text-right pr-5 tabular-nums text-emerald-700 font-semibold"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                        </div>
                      </td>

                      {/* Unit Sales Price */}
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          className="h-8 text-xs bg-white text-right tabular-nums font-bold text-slate-900"
                        />
                      </td>

                      {/* Total Cost */}
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600 font-medium">
                        {formatCurrency(item.qty * item.costPrice)}
                      </td>

                      {/* Total Sales */}
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700">
                        {formatCurrency(item.qty * item.unitPrice)}
                        <div className="text-[10px] font-normal text-slate-400">
                          {formatCurrency(item.qty * item.unitPrice * (1 + item.vatRate / 100))} incl.
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer Totals */}
                <tfoot>
                  {totals.optionalSales > 0 && (
                    <tr className="bg-amber-50 text-amber-700 text-[11px]">
                      <td colSpan={9} className="py-1.5 px-4 text-right">
                        Optionele extra&apos;s (niet in hoofdtotaal, excl. BTW):
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                        {formatCurrency(totals.optionalSales)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white font-semibold">
                    <td colSpan={9} className="py-3 px-4 text-right">
                      Totaal Generaal (Excl. BTW):
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-300">
                      {formatCurrency(totals.totalCost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-emerald-400 font-bold text-sm">
                      {formatCurrency(totals.totalSales)}
                      <div className="text-[10px] font-normal text-slate-400">
                        {formatCurrency(totals.totalSalesIncVat)} incl. BTW
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ProductSet Selector Dialog */}
      <Dialog open={setDialogOpen} onOpenChange={setSetDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Artikelset / Combi Inladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Kies een vooraf samengestelde set (recept) om alle materialen en arbeidsuren in één keer aan je calculatie toe te voegen:
            </p>

            {sets.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border rounded-lg bg-slate-50">
                <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">Nog geen artikelsets aangemaakt</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Maak artikelsets aan via Beheer &rarr; Artikelen om samengestelde modules sneller in te laden.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {sets.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => addProductSet(s)}
                    className="p-3 border rounded-lg hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{s.name}</h4>
                      {s.description && <p className="text-xs text-slate-500 line-clamp-1">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                        <span>{s.items.length} artikelen</span>
                        {s.laborHours > 0 && <span>• {s.laborHours} uur montage</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Inladen
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetDialogOpen(false)}>
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Markup Dialog */}
      <Dialog open={bulkMarkupOpen} onOpenChange={setBulkMarkupOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Marge voor alle regels instellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Opslag percentage (%)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.5"
                value={bulkMarkupPercent}
                onChange={(e) => setBulkMarkupPercent(parseFloat(e.target.value) || 0)}
                className="text-right pr-7"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Dit stelt de winstmarge voor alle huidige calculatieregels in op {bulkMarkupPercent}%.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMarkupOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={applyBulkMarkup}>Toepassen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Create Product Dialog */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuw artikel aanmaken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500">
              Dit artikel wordt toegevoegd aan de catalogus en direct aan deze calculatie.
            </p>
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input
                value={quickCreate.name}
                onChange={(e) => setQuickCreate((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Productnaam"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Input
                  value={quickCreate.category}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Overig"
                />
              </div>
              <div className="space-y-2">
                <Label>Eenheid</Label>
                <Input
                  value={quickCreate.unit}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="stuk"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Netto inkoop (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickCreate.costPrice}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Verkoop (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickCreate.basePrice}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Leverancier</Label>
                <SupplierSelect
                  value={quickCreate.supplier}
                  onChange={(v) => setQuickCreate((prev) => ({ ...prev, supplier: v }))}
                  extraSuppliers={products.map((p) => p.supplier)}
                />
              </div>
              <div className="space-y-2">
                <Label>Artikelcode</Label>
                <Input
                  value={quickCreate.sku}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>EAN</Label>
                <Input
                  value={quickCreate.ean}
                  onChange={(e) => setQuickCreate((prev) => ({ ...prev, ean: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCreateOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleQuickCreate} disabled={quickCreateSaving}>
              {quickCreateSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aanmaken &amp; toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
