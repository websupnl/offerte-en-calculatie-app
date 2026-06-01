"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Send,
  Share2,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  Copy,
  FileText,
  Zap,
} from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import { QuoteBuilder } from "@/components/forms/quote-builder";
import { AdviceDocumentForm } from "@/components/forms/advice-document-form";

type QuoteItem = {
  id: string;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  total: string | number;
  productId: string | null;
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
  status: string;
  validUntil: string | null;
  intro: string | null;
  outro: string | null;
  notes: string | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  createdAt: string;
  customer: { id: string; name: string; email: string | null; address: string | null; city: string | null };
  items: QuoteItem[];
  adviceDocuments: AdviceDocument[];
  share: { token: string; viewedAt: string | null; acceptedAt: string | null } | null;
};

const ADVICE_LABELS: Record<string, string> = {
  BATTERY: "Thuisbatterij advies",
  EMS: "EMS advies",
  SOLAR: "Zonnepanelen advies",
  ELECTRICAL: "Elektrische installatie advies",
  CAMERA: "Camera advies",
  HEATPUMP: "Warmtepomp advies",
};

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
  const [shareUrl, setShareUrl] = useState(
    quote.share ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${quote.share.token}` : ""
  );
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

  async function downloadPdf() {
    toast.info("PDF generatie wordt geladen...");
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
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
              <h1 className="text-2xl font-bold">{quote.number}</h1>
              <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.customer.name} · {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
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
          <TabsTrigger value="edit">
            <Pencil className="mr-2 h-4 w-4" />
            Bewerken
          </TabsTrigger>
          {companySlug === "koolhaas" && (
            <TabsTrigger value="advice">
              <Zap className="mr-2 h-4 w-4" />
              AI Advies ({quote.adviceDocuments.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* View tab */}
        <TabsContent value="view" className="space-y-4">
          {/* Quick status update */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                {["DRAFT", "SENT", "ACCEPTED", "DECLINED"].map((s) => (
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

          {/* Klantgegevens */}
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">{quote.customer.name}</p>
                {quote.customer.email && <p className="text-muted-foreground">{quote.customer.email}</p>}
                {quote.customer.address && <p className="text-muted-foreground">{quote.customer.address}</p>}
                {quote.customer.city && <p className="text-muted-foreground">{quote.customer.city}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Offerte {quote.number}</p>
                <p className="text-muted-foreground">{formatDate(quote.createdAt)}</p>
                {quote.validUntil && (
                  <p className="text-muted-foreground">Geldig tot: {formatDate(quote.validUntil)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Intro */}
          {quote.intro && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm whitespace-pre-wrap">{quote.intro}</p>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-6 py-3 bg-muted/50">
                  <div className="col-span-6">Omschrijving</div>
                  <div className="col-span-2 text-right">Aantal</div>
                  <div className="col-span-2 text-right">Prijs</div>
                  <div className="col-span-2 text-right">Totaal</div>
                </div>
                {quote.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 px-6 py-3 text-sm">
                    <div className="col-span-6">{item.description}</div>
                    <div className="col-span-2 text-right text-muted-foreground">{Number(item.qty)}×</div>
                    <div className="col-span-2 text-right">{formatCurrency(Number(item.unitPrice))}</div>
                    <div className="col-span-2 text-right font-medium">{formatCurrency(Number(item.total))}</div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotaal excl. BTW</span>
                  <span>{formatCurrency(Number(quote.totalExVat))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>BTW</span>
                  <span>{formatCurrency(Number(quote.totalVat))}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Totaal incl. BTW</span>
                  <span>{formatCurrency(Number(quote.totalIncVat))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outro */}
          {quote.outro && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm whitespace-pre-wrap">{quote.outro}</p>
              </CardContent>
            </Card>
          )}

          {/* Advice docs */}
          {quote.adviceDocuments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Adviesdocumenten</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {quote.adviceDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{ADVICE_LABELS[doc.type] ?? doc.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/advice/${doc.id}/pdf`, "_blank")}>
                      <Download className="mr-2 h-3 w-3" />
                      PDF
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Edit tab */}
        <TabsContent value="edit">
          <QuoteBuilder
            customers={customers}
            products={products}
            productSets={productSets}
            companySlug={companySlug}
            companyName={company?.name ?? ""}
            quoteId={quote.id}
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
      </Tabs>
    </div>
  );
}
