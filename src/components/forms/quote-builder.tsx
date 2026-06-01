"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  GripVertical,
  ChevronDown,
  Package,
  Layers,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Customer = { id: string; name: string; email: string | null };
type Product = { id: string; category: string; name: string; basePrice: string | number; vatRate: string | number; unit: string };
type ProductSetItem = { productId: string; qty: string | number; product: Product };
type ProductSet = { id: string; name: string; items: ProductSetItem[] };

type QuoteItem = {
  tempId: string;
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
};

function genId() {
  return Math.random().toString(36).slice(2);
}

export function QuoteBuilder({
  customers,
  products,
  productSets,
  companySlug,
  companyName,
  quoteId,
}: {
  customers: Customer[];
  products: Product[];
  productSets: ProductSet[];
  companySlug: string;
  companyName: string;
  quoteId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [intro, setIntro] = useState("");
  const [outro, setOutro] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([
    { tempId: genId(), description: "", qty: 1, unitPrice: 0, vatRate: 21 },
  ]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<"intro" | "outro" | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const customer = customers.find((c) => c.id === customerId);

  const totalExVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const totalVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice * (i.vatRate / 100), 0);
  const totalIncVat = totalExVat + totalVat;

  function addItem() {
    setItems((prev) => [
      ...prev,
      { tempId: genId(), description: "", qty: 1, unitPrice: 0, vatRate: 21 },
    ]);
  }

  function addProduct(p: Product) {
    setItems((prev) => [
      ...prev,
      {
        tempId: genId(),
        productId: p.id,
        description: p.name,
        qty: 1,
        unitPrice: Number(p.basePrice),
        vatRate: Number(p.vatRate),
      },
    ]);
    setShowProductPicker(false);
  }

  function addSet(set: ProductSet) {
    const newItems = set.items.map((si) => ({
      tempId: genId(),
      productId: si.productId,
      description: si.product.name,
      qty: Number(si.qty),
      unitPrice: Number(si.product.basePrice),
      vatRate: Number(si.product.vatRate),
    }));
    setItems((prev) => [...prev, ...newItems]);
    setShowProductPicker(false);
  }

  function updateItem(tempId: string, field: keyof QuoteItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  async function generateAI(type: "intro" | "outro") {
    if (!customer) return toast.error("Selecteer eerst een klant");
    setAiLoading(type);
    try {
      const res = await fetch("/api/ai/quote-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          context: {
            companyName,
            customerName: customer.name,
            items: items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice })),
          },
        }),
      });
      const data = await res.json();
      if (type === "intro") setIntro(data.text);
      else setOutro(data.text);
      toast.success("Tekst gegenereerd");
    } catch {
      toast.error("AI generatie mislukt");
    } finally {
      setAiLoading(null);
    }
  }

  async function handleSave() {
    if (!customerId) return toast.error("Selecteer een klant");
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");

    setSaving(true);
    try {
      const method = quoteId ? "PUT" : "POST";
      const url = quoteId ? `/api/quotes/${quoteId}` : "/api/quotes";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, validUntil, intro, outro, notes, items }),
      });
      const data = await res.json();
      toast.success(quoteId ? "Offerte opgeslagen" : "Offerte aangemaakt");
      router.push(`/quotes/${quoteId ?? data.id}`);
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{quoteId ? "Offerte bewerken" : "Nieuwe offerte"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Opslaan
          </Button>
        </div>
      </div>

      {/* Header info */}
      <Card>
        <CardHeader><CardTitle>Klant & details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Klant *</Label>
              <Select onValueChange={(v) => { if (v) setCustomerId(v); }} value={customerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer klant" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Geldig tot</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Inleiding</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateAI("intro")}
            disabled={aiLoading === "intro"}
          >
            {aiLoading === "intro" ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3 w-3" />
            )}
            AI genereren
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            placeholder="Schrijf een inleiding of gebruik AI..."
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Regeloverzicht</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProductPicker((v) => !v)}
              >
                <Package className="mr-2 h-3 w-3" />
                Product/set
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              {showProductPicker && (
                <div className="absolute right-0 top-10 z-50 bg-card border rounded-lg shadow-lg w-80 max-h-80 overflow-y-auto p-2 space-y-2">
                  {productSets.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Sets
                      </p>
                      {productSets.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted"
                          onClick={() => addSet(s)}
                        >
                          {s.name} ({s.items.length} items)
                        </button>
                      ))}
                      <Separator className="my-2" />
                    </div>
                  )}
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{cat}</p>
                      {products
                        .filter((p) => p.category === cat)
                        .map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex justify-between"
                            onClick={() => addProduct(p)}
                          >
                            <span>{p.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatCurrency(Number(p.basePrice))}
                            </span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" onClick={addItem}>
              <Plus className="mr-2 h-3 w-3" />
              Vrije regel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
            <div className="col-span-5">Omschrijving</div>
            <div className="col-span-2 text-right">Aantal</div>
            <div className="col-span-2 text-right">Prijs</div>
            <div className="col-span-1 text-right">BTW%</div>
            <div className="col-span-1 text-right">Totaal</div>
            <div className="col-span-1" />
          </div>

          {items.map((item) => (
            <div key={item.tempId} className="grid grid-cols-12 gap-2 items-center group">
              <div className="col-span-5">
                <Input
                  placeholder="Omschrijving..."
                  value={item.description}
                  onChange={(e) => updateItem(item.tempId, "description", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.qty}
                  onChange={(e) => updateItem(item.tempId, "qty", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.tempId, "unitPrice", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  value={item.vatRate}
                  onChange={(e) => updateItem(item.tempId, "vatRate", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </div>
              <div className="col-span-1 text-right text-sm font-medium">
                {formatCurrency(item.qty * item.unitPrice)}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.tempId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <Separator className="my-3" />

          {/* Totals */}
          <div className="space-y-1.5 text-sm ml-auto w-64">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
              <span>{formatCurrency(totalExVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">BTW</span>
              <span>{formatCurrency(totalVat)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Totaal incl. BTW</span>
              <span>{formatCurrency(totalIncVat)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Afsluiting</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateAI("outro")}
            disabled={aiLoading === "outro"}
          >
            {aiLoading === "outro" ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3 w-3" />
            )}
            AI genereren
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={3}
            placeholder="Afsluittekst, betalingsvoorwaarden..."
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
          />
          <div className="space-y-2">
            <Label>Interne notities (niet zichtbaar voor klant)</Label>
            <Textarea
              rows={2}
              placeholder="Notities..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Annuleren</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Offerte opslaan
        </Button>
      </div>
    </div>
  );
}
