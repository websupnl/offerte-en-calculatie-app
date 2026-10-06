"use client";

import { CalculationForkAction } from "@/components/calculations/calculation-fork-action";
import { LinkToQuoteDialog } from "@/components/calculations/link-to-quote-dialog";
import { ConvertMenu } from "@/components/convert/convert-menu";
import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm-provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ArticlePickerDialog } from "@/components/products/article-picker-dialog";
import { SearchablePopoverSelect } from "@/components/forms/searchable-popover-select";
import { SupplierSelect } from "@/components/forms/supplier-select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calculator,
  Plus,
  Save,
  Check,
  FileText,
  Trash2,
  Clock,
  Layers,
  Loader2,
  Percent,
  MapPin,
  Eye,
  EyeOff,
  Repeat,
  GripVertical,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { CALCULATION_ROLES, ROLE_EXPLANATION, ROLE_LABEL, roleLabel, type CalculationRole } from "@/lib/calculation-role";
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
  /** null = eenmalig. Anders een abonnementsprijs per maand of per jaar. */
  recurringInterval?: "maand" | "kwartaal" | "jaar" | null;
  /** Wat de klant bij een optionele regel leest. Leeg = aantal en eenheid. */
  quoteNote?: string | null;
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
  /** BASE telt altijd mee; VARIANT is een keuze voor de klant. */
  role?: CalculationRole;
  sortOrder?: number;
  customer: { id: string; name: string } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string | null; status: string } | null;
  items: CalculationItemState[];
};

export function CalculationBuilderClient({
  initialCalculation,
  siblings = [],
  draftQuotes = [],
  products: initialProducts,
  customers,
  projects,
  sets,
  homeBaseZipCode,
  travelPricingTiers,
}: {
  initialCalculation: CalculationDetail;
  /** De andere calculaties op dezelfde offerte, zodat je ziet wat de klant kiest. */
  siblings?: { id: string; number: string; title: string; role: string }[];
  /** Conceptoffertes waaraan deze calculatie gekoppeld kan worden. */
  draftQuotes?: { id: string; title: string | null; number: string | null; customerId: string; customer: { name: string } }[];
  products: ProductOption[];
  customers: { id: string; name: string; zipCode?: string | null }[];
  projects: { id: string; number: string; title: string }[];
  sets: ProductSetOption[];
  homeBaseZipCode?: string;
  travelPricingTiers?: TravelPricingTier[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [calculation, setCalculation] = useState<CalculationDetail>(initialCalculation);
  const [items, setItems] = useState<CalculationItemState[]>(initialCalculation.items);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [role, setRole] = useState<CalculationRole>(initialCalculation.role ?? "BASE");
  const [variantBezig, setVariantBezig] = useState(false);
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [title, setTitle] = useState(initialCalculation.title);
  const description = initialCalculation.description ?? "";
  const notes = initialCalculation.notes ?? "";
  const [customerId, setCustomerId] = useState(initialCalculation.customerId ?? "");
  const [projectId, setProjectId] = useState(initialCalculation.projectId ?? "");
  const status = initialCalculation.status;

  const [saving, setSaving] = useState(false);
  const [updatingQuote, setUpdatingQuote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Eén opslagmanier, gelijk aan de offerte-editor: de calculatie slaat zichzelf op.
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const autosaveInFlight = useRef(false);
  const firstAutosaveRender = useRef(true);
  const savedSignatureRef = useRef("");

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
    let materialCost = 0;
    let laborSales = 0;

    items.forEach((item) => {
      if (item.optional) {
        optionalSales += item.qty * item.unitPrice;
        return;
      }
      totalCost += item.qty * item.costPrice;
      totalSales += item.qty * item.unitPrice;
      totalVat += item.qty * item.unitPrice * (item.vatRate / 100);
      // Uren zijn eigen arbeid: kostprijs telt niet mee als uitgave
      if (item.type === "LABOR") {
        laborSales += item.qty * item.unitPrice;
      } else {
        materialCost += item.qty * item.costPrice;
      }
    });

    const margin = totalSales - totalCost;
    const marginPct = totalSales > 0 ? (margin / totalSales) * 100 : 0;
    // Wat je overhoudt: materiaalmarge + volledige uuromzet
    const takeHome = totalSales - materialCost;
    const takeHomePct = totalSales > 0 ? (takeHome / totalSales) * 100 : 0;

    return {
      totalCost,
      totalSales,
      totalVat,
      optionalSales,
      totalSalesIncVat: totalSales + totalVat,
      margin,
      marginPct,
      materialCost,
      laborSales,
      takeHome,
      takeHomePct,
    };
  }, [items]);

  // Helper to update a single item property and recalculate prices
  function updateItem(index: number, field: keyof CalculationItemState, val: CalculationItemState[keyof CalculationItemState]) {
    setItems((prev) => {
      const copy = [...prev];
      const current = { ...copy[index], [field]: val };

      // Recalculate cost, markup or unitPrice based on edited field
      if (field === "costPrice" || field === "markupPercent" || field === "qty") {
        const cost = field === "costPrice" ? parseFloat(String(val)) || 0 : current.costPrice;
        const markup = field === "markupPercent" ? parseFloat(String(val)) || 0 : current.markupPercent;
        current.unitPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;
      } else if (field === "unitPrice") {
        const unitP = parseFloat(String(val)) || 0;
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

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleAddVariant(asAlternative = true) {
    setVariantBezig(true);
    try {
      if (!(await handleSave())) return;
      const res = await fetch(`/api/calculations/${calculation.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asAlternative }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Variant maken mislukt");
      toast.success(asAlternative ? "Alternatief aangemaakt in dezelfde conceptofferte" : "Losse kopie aangemaakt");
      router.push(`/calculations/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij variant maken");
    } finally {
      setVariantBezig(false);
    }
  }

  const savePayload = {
    title,
    description,
    status,
    notes,
    customerId: customerId || null,
    projectId: projectId || null,
    role,
    items,
  };
  const currentSignature = JSON.stringify(savePayload);

  // Stille opslag voor autosave: PUT zonder toast, met statusindicatie.
  // De debounce-effect hieronder maakt bij elke wijziging een nieuwe timer met
  // een verse closure, dus deze functie ziet altijd de laatste state.
  const silentSave = async () => {
    if (autosaveInFlight.current) return;
    if (!title.trim()) return;
    autosaveInFlight.current = true;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/calculations/${calculation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Opslaan mislukt");
      setCalculation(updated);
      savedSignatureRef.current = currentSignature;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      autosaveInFlight.current = false;
    }
  };

  // Debounce: 1,5s na de laatste wijziging automatisch opslaan.
  useEffect(() => {
    if (firstAutosaveRender.current) {
      firstAutosaveRender.current = false;
      savedSignatureRef.current = currentSignature;
      return;
    }
    if (!title.trim()) return;
    if (currentSignature === savedSignatureRef.current) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => void silentSave(), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSignature]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  // Directe opslag, gebruikt vóór het omzetten naar een offerte.
  async function handleSave(): Promise<boolean> {
    if (!title.trim()) {
      toast.error("Titel is verplicht");
      return false;
    }
    while (autosaveInFlight.current) {
      await new Promise((r) => setTimeout(r, 100));
    }
    autosaveInFlight.current = true;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/calculations/${calculation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Opslaan mislukt");
      setCalculation(updated);
      savedSignatureRef.current = currentSignature;
      setSaveStatus("saved");
      return true;
    } catch (err) {
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Fout bij opslaan");
      return false;
    } finally {
      autosaveInFlight.current = false;
      setSaving(false);
    }
  }

  async function handleUpdateDraftQuote() {
    if (!calculation.quote) return;
    setUpdatingQuote(true);
    try {
      if (!(await handleSave())) return;
      const res = await fetch(`/api/calculations/${calculation.id}/refresh-quote`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Conceptofferte bijwerken mislukt");
      toast.success("Conceptofferte bijgewerkt met de nieuwste calculatie");
      router.push(`/quotes/${result.quoteId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conceptofferte bijwerken mislukt");
    } finally {
      setUpdatingQuote(false);
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
      if (!(await handleSave())) return;

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
    if (!(await confirm({ title: "Calculatie verwijderen?", body: "Dit kan niet ongedaan gemaakt worden. Archiveren houdt hem bewaard.", confirmLabel: "Verwijderen", destructive: true }))) return;

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
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/calculations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Overzicht
              </Button>
            </Link>

            <div className="flex items-center gap-1.5 text-sm font-medium" aria-live="polite">
              {saveStatus === "saving" && (
                <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Bezig met opslaan</span></>
              )}
              {saveStatus === "saved" && (
                <><Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /><span className="text-emerald-700 dark:text-emerald-400">Opgeslagen</span></>
              )}
              {saveStatus === "unsaved" && (
                <span className="text-muted-foreground">Wijzigingen worden opgeslagen</span>
              )}
              {saveStatus === "idle" && (
                <span className="text-muted-foreground">Slaat automatisch op</span>
              )}
            </div>
            {saveStatus === "error" && (
              <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Opnieuw opslaan
              </Button>
            )}

            <ConvertMenu type="calculation" id={calculation.id} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50" />

            <Button onClick={calculation.quote?.status === "DRAFT" ? handleUpdateDraftQuote : handleConvertToQuote} disabled={converting || updatingQuote}>
              {converting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {calculation.quote?.status === "DRAFT" ? "Concept actualiseren" : "Conceptofferte maken"}
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
        <section aria-label="Calculatiebedragen" className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Materiaalinkoop", value: formatCurrency(totals.materialCost), detail: "Excl. btw" },
            { label: "Verkoopprijs", value: formatCurrency(totals.totalSales), detail: formatCurrency(totals.totalSalesIncVat) + " incl. btw" },
            { label: "Wat je overhoudt", value: formatCurrency(totals.takeHome), detail: "Waarvan " + formatCurrency(totals.laborSales) + " uuromzet" },
            { label: "Marge", value: totals.takeHomePct.toFixed(1) + "%", detail: "Verkoop min materiaal / omzet" },
          ].map(metric => <div key={metric.label} className="border-b border-border px-5 py-4 sm:border-r xl:border-b-0 last:border-r-0">
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{metric.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
          </div>)}
        </section>

        {!calculation.quote && (
          <Card className="border-border bg-card shadow-none">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground">Nog niet gekoppeld aan een offerte</p>
                <p className="text-base text-muted-foreground">
                  Koppel deze calculatie aan een conceptofferte, of maak een nieuwe. Een calculatie kan samen met andere calculaties op één offerte staan.
                </p>
              </div>
              <Button variant="outline" className="shrink-0 text-base" onClick={() => setLinkOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Koppelen aan offerte
              </Button>
            </CardContent>
          </Card>
        )}
        {linkOpen && (
          <LinkToQuoteDialog
            calculations={[{ id: calculation.id, title, number: calculation.number, customer: customerId ? { id: customerId } : null, role: calculation.role, quote: null }]}
            quotes={draftQuotes}
            customers={customers}
            onClose={() => setLinkOpen(false)}
          />
        )}

        {calculation.quote && (
          <Card className="border-border bg-card shadow-none">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <span className="text-sm font-medium text-muted-foreground">
                  Deze calculatie bepaalt de prijs van
                </span>
                <p className="mt-1 text-base font-bold text-foreground">
                  <Link href={`/quotes/${calculation.quote.id}`} className="hover:underline">
                    {calculation.quote.number ?? "Concept zonder nummer"}
                  </Link>
                  {siblings.length > 0 && (
                    <span className="ml-2 text-sm font-medium text-muted-foreground">
                      samen met {siblings.length} andere{siblings.length === 1 ? "" : "n"}
                    </span>
                  )}
                </p>
                {siblings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {siblings.map((zus) => (
                      <Link key={zus.id} href={`/calculations/${zus.id}`}>
                        <Badge variant="outline" className="text-sm font-normal hover:bg-muted/40">
                          {roleLabel(zus.role)} · {zus.title}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-border p-0.5">
                  {CALCULATION_ROLES.map((waarde) => [waarde, ROLE_LABEL[waarde], ROLE_EXPLANATION[waarde]] as const).map(([waarde, label, uitleg]) => (
                    <button
                      key={waarde}
                      type="button"
                      title={uitleg}
                      onClick={() => setRole(waarde)}
                      disabled={calculation.quote?.status !== "DRAFT"}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                        role === waarde ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>


              </div>
            </CardContent>

            {role === "VARIANT" && siblings.filter((z) => z.role === "VARIANT").length === 0 && (
              <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                <p>
                  Eén variant is geen keuze: zolang er maar één is, telt deze calculatie gewoon
                  mee in de prijs. Wat bedoel je?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRole("OPTION")} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                    Meerprijs: de klant kan dit aanvinken
                  </button>
                  <button type="button" onClick={() => setRole("BASE")} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                    Basis: telt altijd mee
                  </button>
                </div>
                <p className="mt-2">
                  Wil je dat de klant kiest tussen twee uitvoeringen? Maak dan een tweede variant met <strong>Maak alternatief</strong>.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Calculation Settings Header */}
        <Card className="bg-card shadow-none">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Gegevens en koppeling</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Titel calculatie *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Klant</Label>
                  {customerId && (
                    <Link href={`/customers/${customerId}`} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ws-accent)] hover:underline">
                      Open klant <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <Label>Project</Label>
                  {projectId && (
                    <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ws-accent)] hover:underline">
                      Open project <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
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


          </CardContent>
        </Card>

        {/* Calculation Items Section */}
        <Card className="bg-card shadow-none">
          <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Calculatieregels ({items.length})</CardTitle>
              <p className="text-base text-muted-foreground mt-0.5">
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
                <Layers className="mr-1.5 h-4 w-4 text-primary" />
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
                <Percent className="mr-1.5 h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                Marge instellen
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-semibold text-foreground">Nog geen calculatieregels</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                  Voeg artikelen toe uit de catalogus, laad een complete set in of voeg vrije uren toe.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground font-semibold border-b">
                    <th className="py-2.5 px-3 w-16">Volgorde</th>
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
                    <Fragment key={idx}>
                    <tr
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedItemIndex !== null) moveItem(draggedItemIndex, idx);
                        setDraggedItemIndex(null);
                      }}
                      onDragEnd={() => setDraggedItemIndex(null)}
                      className={`hover:bg-muted/80 transition-colors ${item.optional ? "bg-amber-50/60" : ""} ${draggedItemIndex === idx ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 px-2 text-muted-foreground font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", String(idx));
                              setDraggedItemIndex(idx);
                            }}
                            onKeyDown={(event) => {
                              if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                                event.preventDefault();
                                moveItem(idx, idx + (event.key === "ArrowUp" ? -1 : 1));
                              }
                            }}
                            className="touch-none cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                            aria-label={`Regel ${idx + 1} verplaatsen. Gebruik Alt plus pijltje omhoog of omlaag om de volgorde aan te passen.`}
                            title="Sleep om te verplaatsen, of gebruik Alt + ↑ / ↓"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <span>{idx + 1}</span>
                        </div>
                      </td>

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
                          className={`h-7 w-7 ${item.hiddenOnQuote ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400"}`}
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
                          className="h-8 text-sm bg-card"
                        />
                        {(item.supplier || item.productId) && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            {item.supplier && (
                              <Badge variant="outline" className="text-sm py-0 px-1 font-normal bg-muted/40">
                                {item.supplier}
                              </Badge>
                            )}
                            {item.sku && <span className="text-sm text-muted-foreground font-mono">Art# {item.sku}</span>}
                            {item.productId && (
                              <Link
                                href={`/admin/products?product=${item.productId}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ws-accent)] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                Open artikel <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
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
                          className="h-8 text-sm bg-card text-center tabular-nums"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-3">
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          className="h-8 text-sm bg-card text-center"
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
                          className="h-8 text-sm bg-card text-right tabular-nums font-medium"
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
                            className="h-8 min-w-[76px] text-sm bg-card text-right pr-5 tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
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
                          className="h-8 text-sm bg-card text-right tabular-nums font-bold text-foreground"
                        />
                      </td>

                      {/* Total Cost */}
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground font-medium">
                        {formatCurrency(item.qty * item.costPrice)}
                      </td>

                      {/* Total Sales */}
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(item.qty * item.unitPrice)}
                        <div className="text-sm font-normal text-muted-foreground">
                          {formatCurrency(item.qty * item.unitPrice * (1 + item.vatRate / 100))} incl.
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>

                    {/* Een optionele regel wordt op de offerte een aanvinkbare extra.
                        Wat de klant daarbij leest hoort hier te staan, niet in de
                        offerte-editor: daar is het niet meer aan een artikel gekoppeld. */}
                    {item.optional && (
                      <tr className="bg-amber-50/60">
                        <td colSpan={2}></td>
                        <td colSpan={10} className="px-3 pb-3 pt-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold uppercase tracking-wider text-amber-800">
                              Op de offerte
                            </span>
                            <Input
                              value={item.quoteNote ?? ""}
                              onChange={(e) => updateItem(idx, "quoteNote", e.target.value)}
                              placeholder={`Toelichting voor de klant. Leeg = "${item.qty} ${item.unit || "stuk"}"`}
                              className="h-8 max-w-md flex-1 bg-card text-sm"
                            />
                            <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-card p-0.5">
                              <Repeat className="ml-1.5 h-3.5 w-3.5 text-amber-700" />
                              {([
                                [null, "Eenmalig"],
                                ["maand", "Per maand"],
                                ["jaar", "Per jaar"],
                              ] as const).map(([waarde, label]) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => updateItem(idx, "recurringInterval", waarde)}
                                  className={`rounded px-2 py-1 text-sm font-semibold transition-colors ${
                                    (item.recurringInterval ?? null) === waarde
                                      ? "bg-amber-600 text-white"
                                      : "text-amber-800 hover:bg-amber-100"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>

                {/* Footer Totals */}
                <tfoot>
                  {totals.optionalSales > 0 && (
                    <tr className="bg-muted/40 text-muted-foreground text-sm">
                      <td colSpan={9} className="py-1.5 px-4 text-right">
                        Optionele extra&apos;s (niet in hoofdtotaal, excl. BTW):
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                        {formatCurrency(totals.optionalSales)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                  <tr className="border-t border-border bg-muted/60 text-foreground font-semibold">
                    <td colSpan={9} className="py-3 px-4 text-right">
                      Totaal excl. btw
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(totals.totalCost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-foreground font-semibold text-base">
                      {formatCurrency(totals.totalSales)}
                      <div className="text-sm font-normal text-muted-foreground">
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
        <CalculationForkAction title={title} busy={variantBezig} canCreateAlternative={Boolean(customerId)} locked={Boolean(calculation.quote && calculation.quote.status !== "DRAFT")} onAlternative={() => void handleAddVariant()} onCopy={() => void handleAddVariant(false)} />
      </div>

      {/* ProductSet Selector Dialog */}
      <Dialog open={setDialogOpen} onOpenChange={setSetDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Artikelset / Combi Inladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Kies een vooraf samengestelde set (recept) om alle materialen en arbeidsuren in één keer aan je calculatie toe te voegen:
            </p>

            {sets.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/40">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">Nog geen artikelsets aangemaakt</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Maak artikelsets aan via Beheer &rarr; Artikelen om samengestelde modules sneller in te laden.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {sets.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => addProductSet(s)}
                    className="p-3 border rounded-lg hover:border-primary/25 hover:bg-primary/10 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{s.name}</h4>
                      {s.description && <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
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
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
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
