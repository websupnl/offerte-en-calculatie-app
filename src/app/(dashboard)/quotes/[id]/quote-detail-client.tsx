"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Share2,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  FileText,
  Zap,
  Printer,
  Calculator,
} from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import { QuoteBuilder } from "@/components/forms/quote-builder";
import { AdviceDocumentForm } from "@/components/forms/advice-document-form";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";

type QuoteItem = {
  id: string;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  costPrice: string | number | null;
  vatRate: string | number;
  total: string | number;
  indent: number;
  productId: string | null;
};

type ChoiceLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  costPrice?: number | null;
  vatRate: number;
  indent: number;
};

type ChoiceGroup = {
  title: string;
  choices: Array<{
    label?: string;
    title: string;
    summary?: string;
    items: ChoiceLineItem[];
  }>;
};

type OptionItem = {
  t: string;
  price: number | null;
  vatRate: number;
};

type QuoteAttachment = {
  id: string;
  title: string | null;
  imageUrl: string;
  caption: string | null;
};

type AdviceDocument = {
  id: string;
  type: string;
  content: string;
  createdAt: string;
};

type Quote = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  validUntil: string | null;
  intro: string | null;
  outro: string | null;
  notes: string | null;
  internalAdvice: string | null;
  choiceGroups: ChoiceGroup[] | null;
  options: OptionItem[] | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  createdAt: string;
  customer: { id: string; name: string; email: string | null; address: string | null; city: string | null };
  items: QuoteItem[];
  attachments: QuoteAttachment[];
  adviceDocuments: AdviceDocument[];
  share: {
    token: string;
    viewedAt: string | null;
    acceptedAt: string | null;
    signerName?: string | null;
    acceptedTotalIncVat?: string | number | null;
    acceptanceSnapshot?: {
      selectedChoices?: Array<{ groupTitle: string; choice: { title: string } }>;
      selectedOptions?: Array<{ t: string }>;
    } | null;
  } | null;
};

function MargeRow({
  label,
  qty,
  unitPrice,
  costPrice,
}: {
  label: string;
  qty: number;
  unitPrice: number;
  costPrice?: number | null;
}) {
  const revenue = unitPrice * qty;
  const cost = costPrice != null ? costPrice * qty : null;
  const profit = cost != null ? revenue - cost : null;
  const pct = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 items-center px-4 py-2 text-sm border-b last:border-0 hover:bg-muted/40">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right w-8">{qty}×</span>
      <span className="tabular-nums text-right w-24">{unitPrice > 0 ? formatCurrency(unitPrice) : <span className="text-muted-foreground text-xs">inbegrepen</span>}</span>
      <span className="tabular-nums text-right w-24">{cost != null ? formatCurrency(cost) : <span className="text-muted-foreground">—</span>}</span>
      <span className={`tabular-nums text-right w-24 font-medium ${profit != null && profit < 0 ? "text-destructive" : profit != null ? "text-emerald-600" : "text-muted-foreground"}`}>
        {profit != null ? (
          <>{formatCurrency(profit)}{pct != null && <span className="ml-1 text-xs opacity-70">({pct.toFixed(0)}%)</span>}</>
        ) : "—"}
      </span>
    </div>
  );
}

function CalculatieTab({ quote }: { quote: Quote }) {
  const baseItems = quote.items.filter((i) => Number(i.unitPrice) > 0 || Number(i.costPrice) > 0);
  const choiceGroups: ChoiceGroup[] = Array.isArray(quote.choiceGroups) ? quote.choiceGroups : [];
  const options: OptionItem[] = Array.isArray(quote.options) ? quote.options : [];

  const baseCost = quote.items.reduce((sum, i) => sum + (Number(i.costPrice) || 0) * Number(i.qty), 0);
  const baseRevenue = quote.items.reduce((sum, i) => sum + Number(i.unitPrice) * Number(i.qty), 0);

  return (
    <div className="space-y-6">
      {/* Vaste basis */}
      {baseItems.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
              <span>Vaste werkzaamheden</span>
              <span className="w-8 text-right">Qty</span>
              <span className="w-24 text-right">Verkoop (ex)</span>
              <span className="w-24 text-right">Inkoop totaal</span>
              <span className="w-24 text-right">Winst</span>
            </div>
            {baseItems.map((item) => (
              <MargeRow
                key={item.id}
                label={item.description}
                qty={Number(item.qty)}
                unitPrice={Number(item.unitPrice)}
                costPrice={item.costPrice != null ? Number(item.costPrice) : null}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Configuraties */}
      {choiceGroups.map((group, gi) => (
        <div key={gi} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h3>
          {group.choices.map((choice, ci) => {
            const isRecommended = choice.label === "Aanbevolen";
            const mainItems = choice.items.filter((i) => i.indent === 0);
            const choiceRevenue = mainItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
            const choiceCost = mainItems.reduce((s, i) => s + (i.costPrice ?? 0) * i.qty, 0);
            const choiceProfit = choiceRevenue > 0 && choiceCost > 0 ? choiceRevenue - choiceCost : null;
            const choicePct = choiceProfit != null && choiceRevenue > 0 ? (choiceProfit / choiceRevenue) * 100 : null;
            return (
              <Card key={ci} className={isRecommended ? "border-emerald-300" : ""}>
                <CardContent className="p-0">
                  <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b ${isRecommended ? "bg-emerald-50/50 text-emerald-700" : "bg-muted/30 text-muted-foreground"}`}>
                    <span>{choice.title}{isRecommended && " ★"}</span>
                    <span className="w-8 text-right">Qty</span>
                    <span className="w-24 text-right">Verkoop (ex)</span>
                    <span className="w-24 text-right">Inkoop totaal</span>
                    <span className="w-24 text-right">Winst</span>
                  </div>
                  {mainItems.map((item, ii) => (
                    <MargeRow
                      key={ii}
                      label={item.description}
                      qty={item.qty}
                      unitPrice={item.unitPrice}
                      costPrice={item.costPrice}
                    />
                  ))}
                  {choiceProfit != null && (
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2 text-sm border-t bg-muted/20 font-medium">
                      <span className="text-muted-foreground">Subtotaal</span>
                      <span className="w-8" />
                      <span className="w-24 text-right tabular-nums">{formatCurrency(choiceRevenue)}</span>
                      <span className="w-24 text-right tabular-nums">{formatCurrency(choiceCost)}</span>
                      <span className="w-24 text-right tabular-nums text-emerald-600">
                        {formatCurrency(choiceProfit)}
                        {choicePct != null && <span className="ml-1 text-xs opacity-70">({choicePct.toFixed(0)}%)</span>}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {/* Optioneel meerwerk */}
      {options.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
              <span>Optioneel meerwerk</span>
              <span className="w-8 text-right">Qty</span>
              <span className="w-24 text-right">Prijs (ex)</span>
              <span className="w-24 text-right">—</span>
              <span className="w-24 text-right">—</span>
            </div>
            {options.filter((o) => o.price != null).map((o, i) => (
              <MargeRow key={i} label={o.t} qty={1} unitPrice={o.price ?? 0} costPrice={null} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Samenvatting — aanbevolen scenario */}
      {(() => {
        const recommended = choiceGroups
          .flatMap((g) => g.choices)
          .find((c) => c.label === "Aanbevolen") ?? choiceGroups.flatMap((g) => g.choices)[0];

        if (!recommended) return null;

        const recRevenue = recommended.items
          .filter((i) => i.indent === 0)
          .reduce((s, i) => s + i.unitPrice * i.qty, 0);
        const recCost = recommended.items
          .filter((i) => i.indent === 0)
          .reduce((s, i) => s + (i.costPrice ?? 0) * i.qty, 0);

        const totalRevenue = baseRevenue + recRevenue;
        const totalCost = baseCost + recCost;
        const totalProfit = totalRevenue - totalCost;
        const totalPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        if (totalCost === 0) return null;

        return (
          <Card className="border-2">
            <CardContent className="pt-5 pb-4 px-5 space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Samenvatting — {recommended.title}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Omzet (excl. BTW)</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Inkoopkosten</p>
                  <p className="text-lg font-bold tabular-nums text-muted-foreground">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brutowinst</p>
                  <p className={`text-lg font-bold tabular-nums ${totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brutomarge</p>
                  <p className={`text-lg font-bold ${totalPct >= 15 ? "text-emerald-600" : totalPct >= 10 ? "text-amber-600" : "text-destructive"}`}>
                    {totalPct.toFixed(1)}%
                  </p>
                </div>
              </div>
              {quote.internalAdvice && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Intern advies tonen</summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-mono">{quote.internalAdvice}</pre>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary", SENT: "outline", VIEWED: "outline",
  ACCEPTED: "default", DECLINED: "destructive", EXPIRED: "secondary",
};

export function QuoteDetailClient({
  quote,
  company,
  companySlug,
  customers,
  products,
  productSets,
}: {
  quote: Quote;
  company: { name: string; branding: Record<string, string> } | null;
  companySlug: string;
  customers: { id: string; name: string; email: string | null }[];
  products: { id: string; category: string; name: string; basePrice: string | number; vatRate: string | number; unit: string }[];
  productSets: { id: string; name: string; items: { productId: string; qty: string | number; product: { id: string; name: string; basePrice: string | number; vatRate: string | number; category: string; unit: string } }[] }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("view");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (quote.share) {
      const timeout = window.setTimeout(() => {
        setShareUrl(`${window.location.origin}/q/${quote.share?.token}`);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [quote.share]);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/share`, { method: "POST" });
      const data = await res.json();
      const url = `${window.location.origin}/q/${data.token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Link gekopieerd naar klembord!");
    } catch {
      toast.error("Delen mislukt");
    } finally {
      setSharing(false);
    }
  }

  async function handleStatusChange(status: string) {
    setUpdatingStatus(true);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    toast.success("Status bijgewerkt");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je deze offerte wilt verwijderen?")) return;
    await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
    toast.success("Offerte verwijderd");
    router.push("/quotes");
  }

  function handlePrint() {
    window.open(`/print/quotes/${quote.id}?auto=1`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-6 p-6 lg:p-8 2xl:px-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{quote.title || quote.number}</h1>
              <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.number} · {quote.customer.name} · {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Delen
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Share URL display */}
      {shareUrl && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3 text-sm">
          <Share2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate">{shareUrl}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Gekopieerd!"); }}
          >
            <Copy className="h-3 w-3" />
          </Button>
          {quote.share?.viewedAt && (
            <Badge variant="outline" className="text-xs shrink-0">
              Bekeken {formatDate(quote.share.viewedAt)}
            </Badge>
          )}
          {quote.share?.acceptedAt && (
            <Badge className="text-xs shrink-0">Geaccepteerd</Badge>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="view">
            <FileText className="mr-2 h-4 w-4" />
            Offerte
          </TabsTrigger>
          {quote.status !== "ACCEPTED" && (
            <TabsTrigger value="edit">
              <Pencil className="mr-2 h-4 w-4" />
              Bewerken
            </TabsTrigger>
          )}
          {companySlug === "koolhaas" && (
            <TabsTrigger value="advice">
              <Zap className="mr-2 h-4 w-4" />
              AI Advies ({quote.adviceDocuments.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="calculatie">
            <Calculator className="mr-2 h-4 w-4" />
            Calculatie
          </TabsTrigger>
        </TabsList>

        {/* View tab */}
        <TabsContent value="view" className="space-y-4">
          {/* Quick status update */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                {(quote.status === "ACCEPTED" ? ["ACCEPTED"] : ["DRAFT", "SENT", "DECLINED"]).map((s) => (
                  <Button
                    key={s}
                    variant={quote.status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(s)}
                    disabled={updatingStatus}
                  >
                    {QUOTE_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {quote.share?.acceptedAt && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="grid gap-3 pt-4 text-sm md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-bold text-emerald-950">Definitieve opdracht</p>
                  <p className="mt-1 text-emerald-800">
                    Ondertekend door {quote.share.signerName || quote.customer.name} op {formatDate(quote.share.acceptedAt)}.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quote.share.acceptanceSnapshot?.selectedChoices?.map(({ groupTitle, choice }) => (
                      <Badge key={`${groupTitle}-${choice.title}`} variant="outline">{groupTitle}: {choice.title}</Badge>
                    ))}
                    {quote.share.acceptanceSnapshot?.selectedOptions?.map((option) => (
                      <Badge key={option.t} variant="outline">Meerwerk: {option.t}</Badge>
                    ))}
                  </div>
                </div>
                <strong className="text-lg text-emerald-950">
                  {formatCurrency(Number(quote.share.acceptedTotalIncVat ?? quote.totalIncVat))}
                </strong>
              </CardContent>
            </Card>
          )}

          <QuoteSheetPreview quote={quote as never} companySlug={companySlug} />
        </TabsContent>

        {/* Edit tab */}
        <TabsContent value="edit">
          <QuoteBuilder
            customers={customers}
            products={products}
            productSets={productSets}
            companySlug={companySlug}
            companyName={company?.name ?? ""}
            initialQuote={quote}
          />
        </TabsContent>

        {/* Advice tab (Koolhaas only) */}
        {companySlug === "koolhaas" && (
          <TabsContent value="advice">
            <AdviceDocumentForm
              quoteId={quote.id}
              products={products}
              existingDocs={quote.adviceDocuments}
            />
          </TabsContent>
        )}

        {/* Calculatie tab */}
        <TabsContent value="calculatie">
          <CalculatieTab quote={quote} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
