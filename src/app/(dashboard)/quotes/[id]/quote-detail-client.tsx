"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  Mail,
  Calculator,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, QUOTE_STATUS_LABELS } from "@/lib/format";
import { QuoteBuilder } from "@/components/forms/quote-builder";
import { AdviceDocumentForm } from "@/components/forms/advice-document-form";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { SheetScaler } from "@/components/sheet-scaler";
import { filenameFromResponse } from "@/lib/download-filename";
import { defaultQuoteEmailMessage } from "@/lib/quote-email-copy";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  hiddenOnQuote?: boolean;
};

type ChoiceLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  costPrice?: number | null;
  vatRate: number;
  indent: number;
  hiddenOnQuote?: boolean;
};

type ChoiceGroup = {
  id: string;
  title: string;
  type: "SINGLE_SELECT";
  recommendedChoiceId?: string;
  choices: Array<{
    id: string;
    label?: string;
    title: string;
    summary?: string;
    items: ChoiceLineItem[];
  }>;
};

type OptionItem = {
  id: string;
  t: string;
  d: string;
  tag: string;
  price: number | null;
  vatRate: number;
  details: string[];
  technicalCondition?: string;
};

type QuoteAttachment = {
  id: string;
  title: string | null;
  imageUrl: string;
  storageRef?: string | null;
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
  pdfUrl: string | null;
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
  sentAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  customer: { id: string; name: string; email: string | null; address: string | null; city: string | null; zipCode: string | null };
  items: QuoteItem[];
  attachments: QuoteAttachment[];
  adviceDocuments: AdviceDocument[];
  events: { id: string; type: string; detail: string | null; actor: string | null; createdAt: string }[];
  share: {
    token: string;
    viewedAt: string | null;
    lastViewedAt?: string | null;
    viewCount?: number;
    acceptedAt: string | null;
    declinedAt?: string | null;
    signerName?: string | null;
    acceptedTotalIncVat?: string | number | null;
    selectedOptionIds?: string[] | null;
    acceptanceSnapshot?: {
      selectedChoices?: Array<{ groupTitle: string; choice: { title: string } }>;
      selectedOptions?: Array<{ t: string }>;
    } | null;
  } | null;
};

const EVENT_LABELS: Record<string, string> = {
  SENT: "Verstuurd per e-mail",
  VIEWED: "Bekeken door klant",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Afgewezen",
  EXPIRED: "Verlopen",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary", SENT: "outline", VIEWED: "outline",
  ACCEPTED: "default", DECLINED: "destructive", EXPIRED: "secondary",
};

export function QuoteDetailClient({
  quote,
  company,
  companySlug,
  homeBaseZipCode,
  travelPricingTiers,
  customers,
  products,
  productSets,
}: {
  quote: Quote;
  company: { name: string; branding: Record<string, string> } | null;
  companySlug: string;
  homeBaseZipCode?: string;
  travelPricingTiers?: { maxKm: number | null; price: number }[];
  customers: { id: string; name: string; email: string | null; address?: string | null; city?: string | null; zipCode?: string | null }[];
  products: { id: string; category: string; name: string; basePrice: string | number; vatRate: string | number; unit: string }[];
  productSets: { id: string; name: string; items: { productId: string; qty: string | number; product: { id: string; name: string; basePrice: string | number; vatRate: string | number; category: string; unit: string } }[] }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("view");
  const [sharing, setSharing] = useState(false);
  const [openingMail, setOpeningMail] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState(() => defaultQuoteEmailMessage(companySlug));
  const [shareUrl, setShareUrl] = useState("");
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const pdfReady = Boolean(quote.pdfUrl) || pdfGenerated;
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Poll for PDF readiness while generating
  useEffect(() => {
    if (pdfReady) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 15) { clearInterval(interval); return; }
      try {
        const res = await fetch(`/api/quotes/${quote.id}/pdf/status`);
        if (res.ok) {
          const { pdfReady: ready } = await res.json();
          if (ready) { setPdfGenerated(true); clearInterval(interval); }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [pdfReady, quote.id]);

  useEffect(() => {
    if (quote.share) {
      const timeout = window.setTimeout(() => {
        setShareUrl(`${window.location.origin}/q/${quote.share?.token}`);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [quote.share]);

  // Auto-refresh when quote is awaiting customer response, so acceptance shows without manual reload
  useEffect(() => {
    if (quote.status !== "SENT" && quote.status !== "VIEWED") return;
    const interval = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(interval);
  }, [quote.status, router]);

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


  function openSendQuoteDialog() {
    if (!quote.customer.email) {
      toast.error("Deze klant heeft geen e-mailadres");
      return;
    }
    setEmailMessage(defaultQuoteEmailMessage(companySlug));
    setSendDialogOpen(true);
  }

  async function handleSendQuoteEmail() {
    if (!emailMessage.trim()) {
      toast.error("Vul een e-mailtekst in");
      return;
    }

    setOpeningMail(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: emailMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Versturen mislukt");

      setShareUrl(data.url);
      setSendDialogOpen(false);
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Offerte verstuurd naar ${quote.customer.email}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versturen mislukt");
    } finally {
      setOpeningMail(false);
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

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Dupliceren mislukt");
      const created = await res.json();
      toast.success(`Offerte gedupliceerd als ${created.number}`);
      router.push(`/quotes/${created.id}`);
    } catch {
      toast.error("Dupliceren mislukt");
    } finally {
      setDuplicating(false);
    }
  }

  async function handlePrint() {
    if (pdfDownloading) return;
    setPdfDownloading(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/pdf`);
      if (!res.ok) throw new Error("PDF downloaden mislukt");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromResponse(res, "offerte.pdf");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfGenerated(true);
    } catch {
      toast.error("PDF downloaden mislukt");
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-5 p-4 sm:p-5 lg:p-8 2xl:px-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl">{quote.title || quote.number}</h1>
              <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {quote.number} · {quote.customer.name} · {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-12 md:pl-0">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={pdfDownloading} className="no-print">
            {pdfDownloading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />PDF wordt gemaakt...</>
              : <><Printer className="mr-2 h-4 w-4" />Print / PDF{pdfReady ? "" : " maken"}</>
            }
          </Button>
          <Button size="sm" onClick={openSendQuoteDialog} disabled={openingMail}>
            {openingMail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Verstuur offerte
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Delen
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
            {duplicating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Dupliceren
          </Button>
          <Link href={`/quotes/${quote.id}/calculatie`}>
            <Button variant="outline" size="sm">
              <Calculator className="mr-2 h-4 w-4" />
              Calculatie
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={(open) => !openingMail && setSendDialogOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Offerte per e-mail versturen</DialogTitle>
            <DialogDescription>
              Naar {quote.customer.name} via {quote.customer.email}. Pas de standaardtekst eventueel aan voordat u verstuurt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quote-email-message">E-mailtekst</Label>
            <Textarea
              id="quote-email-message"
              value={emailMessage}
              onChange={(event) => setEmailMessage(event.target.value)}
              maxLength={2000}
              rows={6}
              disabled={openingMail}
              className="min-h-32 resize-y"
            />
            <p className="text-xs text-muted-foreground">
              De aanhef, offerteknop, bijlagen en ondertekening worden automatisch toegevoegd.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={openingMail}>
              Annuleren
            </Button>
            <Button onClick={handleSendQuoteEmail} disabled={openingMail || !emailMessage.trim()}>
              {openingMail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {openingMail ? "Bezig met versturen..." : "Nu versturen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {(quote.share.viewCount ?? 0) > 1 ? ` · ${quote.share.viewCount}x` : ""}
            </Badge>
          )}
          {quote.share?.acceptedAt && (
            <Badge className="text-xs shrink-0">Geaccepteerd</Badge>
          )}
        </div>
      )}

      {quote.sentAt && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Tijdlijn</p>
              <p className="text-xs text-slate-400">
                Verstuurd op {formatDateTime(quote.sentAt)}
                {quote.sendCount > 1 ? ` · ${quote.sendCount}x verstuurd` : ""}
                {quote.share?.viewCount ? ` · ${quote.share.viewCount}x bekeken` : " · nog niet geopend"}
              </p>
            </div>
            {quote.events.length > 0 ? (
              <ol className="mt-3 space-y-2 text-sm">
                {quote.events.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{EVENT_LABELS[event.type] ?? event.type}</p>
                      {event.detail && <p className="truncate text-xs text-slate-400">{event.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Nog geen activiteit geregistreerd.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border bg-card p-2 shadow-sm">
            <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Offerte editor
            </p>
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  activeTab === "view" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">Preview</span>
                  <span className={`block text-xs ${activeTab === "view" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                    Bekijk klantversie
                  </span>
                </span>
              </button>
              {quote.status !== "ACCEPTED" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    activeTab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium">Bewerken</span>
                    <span className={`block text-xs ${activeTab === "edit" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      Inhoud, prijzen, opties
                    </span>
                  </span>
                </button>
              )}
              {companySlug === "koolhaas" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("advice")}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    activeTab === "advice" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium">AI advies</span>
                    <span className={`block text-xs ${activeTab === "advice" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      {quote.adviceDocuments.length} document(en)
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
        {activeTab === "view" && (
          <div className="space-y-4">
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

          <SheetScaler>
            <QuoteSheetPreview
              quote={quote as never}
              companySlug={companySlug}
              selectedOptionIds={(quote.share?.selectedOptionIds as string[] | undefined) ?? []}
            />
          </SheetScaler>
          </div>
        )}

        {activeTab === "edit" && (
          <QuoteBuilder
            customers={customers}
            products={products}
            productSets={productSets}
            companySlug={companySlug}
            companyName={company?.name ?? ""}
            homeBaseZipCode={homeBaseZipCode}
            travelPricingTiers={travelPricingTiers}
            initialQuote={quote}
          />
        )}

        {activeTab === "advice" && companySlug === "koolhaas" && (
            <AdviceDocumentForm
              quoteId={quote.id}
              products={products}
              existingDocs={quote.adviceDocuments}
            />
        )}
        </section>
      </div>
    </div>
  );
}
