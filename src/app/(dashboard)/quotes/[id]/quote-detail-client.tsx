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
  vatRate: string | number;
  total: string | number;
  productId: string | null;
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
      </Tabs>
    </div>
  );
}
