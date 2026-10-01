"use client";

import { ConvertMenu } from "@/components/convert/convert-menu";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
  ChevronDown,
  MoreVertical,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  CalendarClock,
  Repeat,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/confirm-provider";
import { formatCurrency, formatDate, formatDateTime, QUOTE_STATUS_LABELS } from "@/lib/format";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { SheetScaler } from "@/components/sheet-scaler";
import { filenameFromResponse } from "@/lib/download-filename";
import { defaultQuoteEmailMessage, defaultQuoteExtensionMessage, defaultQuoteExtensionSubject } from "@/lib/quote-email-copy";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceAuditLine, PriceAuditIssue } from "@/lib/quote-price-audit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const QuoteBuilder = dynamic(() => import("@/components/forms/quote-builder").then((module) => module.QuoteBuilder), {
  loading: () => <p className="p-6 text-base text-muted-foreground">Editor laden...</p>,
});
const AdviceDocumentForm = dynamic(() => import("@/components/forms/advice-document-form").then((module) => module.AdviceDocumentForm), {
  loading: () => <p className="p-6 text-base text-muted-foreground">Advies laden...</p>,
});

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
  number: string | null;
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
  archivedAt: string | null;
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
  calculations: { id: string; number: string; title: string; role: string }[];
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

const PRICE_ISSUE_LABELS: Record<PriceAuditIssue, string> = {
  changed: "Inkoopprijs gewijzigd",
  inactive: "Artikel niet meer actief",
  unlinked: "Geen artikelkoppeling",
  "no-price": "Geen actuele inkoopprijs",
  stale: "Prijs ouder dan 90 dagen of zonder prijsdatum",
};

export function QuoteDetailClient({
  quote,
  company,
  companySlug,
  homeBaseZipCode,
  travelPricingTiers,
}: {
  quote: Quote;
  company: { name: string; branding: Record<string, string> } | null;
  companySlug: string;
  homeBaseZipCode?: string;
  travelPricingTiers?: { maxKm: number | null; price: number }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("view");
  const [editorData, setEditorData] = useState<{
    customers: { id: string; name: string; email: string | null; address?: string | null; city?: string | null; zipCode?: string | null }[];
    products: { id: string; category: string; name: string; basePrice: string | number; vatRate: string | number; unit: string }[];
    productSets: { id: string; name: string; items: { productId: string; qty: string | number; product: { id: string; name: string; basePrice: string | number; vatRate: string | number; category: string; unit: string } }[] }[];
  } | null>(null);
  const [editorError, setEditorError] = useState(false);

  useEffect(() => {
    if (activeTab === "view" || editorData || editorError) return;
    let cancelled = false;
    fetch(`/api/quotes/${quote.id}/editor-data`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Bewerkgegevens konden niet worden geladen");
        return response.json();
      })
      .then((data) => { if (!cancelled) setEditorData(data); })
      .catch(() => { if (!cancelled) setEditorError(true); });
    return () => { cancelled = true; };
  }, [activeTab, editorData, editorError, quote.id]);
  const [archiving, setArchiving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [openingMail, setOpeningMail] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState(() => defaultQuoteEmailMessage(companySlug));
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendSubject, setExtendSubject] = useState(() => defaultQuoteExtensionSubject(companySlug, quote.number ?? "concept"));
  const [extendMessage, setExtendMessage] = useState(() => defaultQuoteExtensionMessage(companySlug));
  const [notifyOnExtend, setNotifyOnExtend] = useState(Boolean(quote.customer.email));
  const [shareUrl, setShareUrl] = useState("");
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const pdfReady = Boolean(quote.pdfUrl) || pdfGenerated;
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [priceAuditOpen, setPriceAuditOpen] = useState(false);
  const [priceAuditLoading, setPriceAuditLoading] = useState(false);
  const [priceAuditLines, setPriceAuditLines] = useState<PriceAuditLine[] | null>(null);

  async function openPriceAudit() {
    setPriceAuditOpen(true);
    setPriceAuditLoading(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id}/price-audit`, { cache: "no-store" });
      if (!response.ok) throw new Error("Prijscontrole kon niet worden geladen");
      const data: { lines: PriceAuditLine[] } = await response.json();
      setPriceAuditLines(data.lines);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Prijscontrole mislukt");
    } finally {
      setPriceAuditLoading(false);
    }
  }

  useEffect(() => {
    if (quote.share) {
      const timeout = window.setTimeout(() => {
        setShareUrl(`${window.location.origin}/q/${quote.share?.token}`);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [quote.share]);

  // Check only a small status payload. A full refresh reloads the entire editor,
  // product catalogue and preview, so do that only when customer activity changed.
  useEffect(() => {
    if (quote.status !== "SENT" && quote.status !== "VIEWED") return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/quotes/${quote.id}/activity-status`, { cache: "no-store" });
        if (!response.ok) return;
        const activity: { status: string; viewCount: number; acceptedAt: string | null; declinedAt: string | null } = await response.json();
        if (
          activity.status !== quote.status ||
          activity.viewCount !== (quote.share?.viewCount ?? 0) ||
          activity.acceptedAt !== (quote.share?.acceptedAt ?? null) ||
          activity.declinedAt !== (quote.share?.declinedAt ?? null)
        ) router.refresh();
      } catch { /* Keep the current view if the check fails. */ }
    }, 60_000);
    return () => clearInterval(interval);
  }, [quote.id, quote.status, quote.share?.viewCount, quote.share?.acceptedAt, quote.share?.declinedAt, router]);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

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
    try {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Status wijzigen mislukt");
      toast.success("Status bijgewerkt");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status wijzigen mislukt");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Offerte verwijderen?",
      body: "De offerte wordt definitief verwijderd, inclusief regels en deellinks. Archiveren houdt hem bewaard.",
      confirmLabel: "Verwijderen",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
    toast.success("Offerte verwijderd");
    router.push("/quotes");
  }

  async function handleArchive(archived: boolean) {
    setArchiving(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Mislukt");
      toast.success(archived ? "Offerte gearchiveerd" : "Offerte teruggezet");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setArchiving(false);
    }
  }

  async function handleVerbalAccept() {
    const ok = await confirm({
      title: "Op akkoord zetten?",
      body: `De offerte gaat op akkoord namens ${quote.customer.name} (mondeling bevestigd). Dit legt een akkoord-record vast, maakt abonnementen aan voor terugkerende regels en stuurt de klant een bevestigingsmail.`,
      confirmLabel: "Op akkoord zetten",
    });
    if (!ok) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "verbal_confirmed", signerName: quote.customer.name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Mislukt");
      toast.success("Offerte op akkoord gezet");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleExtend() {
    setExtendSubject(defaultQuoteExtensionSubject(companySlug, quote.number ?? "concept"));
    setExtendMessage(defaultQuoteExtensionMessage(companySlug));
    setNotifyOnExtend(Boolean(quote.customer.email));
    setExtendDialogOpen(true);
  }

  async function handleConfirmExtend() {
    if (notifyOnExtend && (!extendSubject.trim() || !extendMessage.trim())) {
      toast.error("Vul een onderwerp en e-mailtekst in");
      return;
    }
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: 14,
          notifyCustomer: notifyOnExtend,
          ...(notifyOnExtend ? { emailSubject: extendSubject.trim(), emailMessage: extendMessage.trim() } : {}),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Mislukt");
      setExtendDialogOpen(false);
      if (result.mailSent) {
        toast.success("Offerte verlengd en klant gemaild");
      } else if (notifyOnExtend) {
        toast.warning(`Offerte verlengd, maar mail niet verstuurd: ${result.mailError ?? "onbekende fout"}`);
      } else {
        toast.success("Offerte verlengd zonder e-mail");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Dupliceren mislukt");
      const created = await res.json();
      toast.success("Offerte als nieuw concept gekopieerd");
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
    <div className="mx-auto w-full max-w-[1800px] space-y-3 p-4 sm:p-5 lg:px-8 lg:py-5 2xl:px-10">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl">{quote.title || quote.number || "Conceptofferte"}</h1>
              <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {quote.number ?? "Nog geen offertenummer"} · {quote.customer.name} · {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openPriceAudit} disabled={priceAuditLoading} className="h-9 text-base">
            {priceAuditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check prijzen
          </Button>
          <Button size="sm" onClick={openSendQuoteDialog} disabled={openingMail} className="h-9 text-base">
            {openingMail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Verstuur offerte
          </Button>
          <ConvertMenu type="quote" id={quote.id} />
          {quote.calculations.length === 1 ? (
            <Link href={`/calculations/${quote.calculations[0].id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "h-9 text-base" })}>
              <Calculator className="h-4 w-4" /> Open calculatie
            </Link>
          ) : quote.calculations.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "h-9 text-base" })}>
                <Calculator className="h-4 w-4" /> Calculaties <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
                {quote.calculations.map((calculation) => (
                  <DropdownMenuItem key={calculation.id} render={<Link href={`/calculations/${calculation.id}`} />}>
                    {calculation.role === "VARIANT" ? "Variant" : "Basis"}: {calculation.number} · {calculation.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Meer acties"
              disabled={archiving}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handlePrint} disabled={pdfDownloading}>
                {pdfDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {pdfDownloading ? "PDF maken..." : pdfReady ? "Download offerte-PDF" : "Maak offerte-PDF"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare} disabled={sharing}>
                <Share2 className="h-4 w-4" /> Deel klantlink
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
                <Copy className="h-4 w-4" /> Dupliceer als concept
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/quotes/${quote.id}/calculatie`} />}>
                <FileText className="h-4 w-4" /> Prijsoverzicht (print)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {quote.status !== "ACCEPTED" && (
                <DropdownMenuItem onClick={handleVerbalAccept}>
                  <CheckCircle2 className="h-4 w-4" /> Op akkoord (mondeling)
                </DropdownMenuItem>
              )}
              {quote.status !== "ACCEPTED" && quote.status !== "DRAFT" && (
                <DropdownMenuItem onClick={() => handleStatusChange("DRAFT")} disabled={updatingStatus}>
                  Markeer als concept
                </DropdownMenuItem>
              )}
              {quote.status !== "ACCEPTED" && quote.status !== "DECLINED" && (
                <DropdownMenuItem onClick={() => handleStatusChange("DECLINED")} disabled={updatingStatus}>
                  Markeer als afgewezen
                </DropdownMenuItem>
              )}
              {["SENT", "VIEWED", "EXPIRED", "DECLINED"].includes(quote.status) && (
                <DropdownMenuItem onClick={handleExtend}>
                  <CalendarClock className="h-4 w-4" /> Verleng offerte (+14 dagen)
                </DropdownMenuItem>
              )}
              {quote.status === "ACCEPTED" && (
                <DropdownMenuItem onClick={() => router.push("/subscriptions")}>
                  <Repeat className="h-4 w-4" /> Bekijk abonnementen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {quote.archivedAt ? (
                <DropdownMenuItem onClick={() => handleArchive(false)}>
                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleArchive(true)}>
                  <Archive className="h-4 w-4" /> Archiveren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={priceAuditOpen} onOpenChange={setPriceAuditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prijscontrole: {quote.number ?? "Concept"}</DialogTitle>
            <DialogDescription>
              Vergelijk de offerte met de huidige artikelprijzen. Er wordt niets aangepast.
            </DialogDescription>
          </DialogHeader>
          {priceAuditLoading ? (
            <p className="py-6 text-base text-muted-foreground">Prijzen controleren...</p>
          ) : priceAuditLines ? (
            <div className="space-y-4">
              <p className="text-base font-medium">
                {priceAuditLines.filter((line) => line.issues.length > 0).length} van {priceAuditLines.length} materiaalregels vragen aandacht
              </p>
              {quote.calculations.length === 0 && (
                <p className="rounded-lg border border-border bg-muted p-3 text-base text-foreground">
                  Deze offerte heeft nog geen live calculatie. Dupliceer hem als concept en maak daar een basiscalculatie om de prijzen en opbouw te herzien.
                </p>
              )}
              {priceAuditLines.length === 0 && (
                <p className="text-base text-muted-foreground">Geen materiaalregels gevonden. Controleer eventuele losse keuzeopties handmatig.</p>
              )}
              <div className="space-y-2">
                {priceAuditLines.map((line, index) => (
                  <div key={`${line.calculationId ?? "quote"}-${index}`} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-foreground">{line.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {line.calculationNumber ?? "Oude offerteregel"} · {line.qty} × inkoop {line.quotedCost === null ? "onbekend" : formatCurrency(line.quotedCost)}
                          {line.currentCost !== null ? ` → ${formatCurrency(line.currentCost)}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-md px-2 py-1 text-sm font-medium ${line.issues.length ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"}`}>
                        {line.issues.length ? "Controleren" : "Actueel"}
                      </span>
                    </div>
                    {line.issues.length > 0 && (
                      <p className="mt-2 text-sm text-foreground">{line.issues.map((issue) => PRICE_ISSUE_LABELS[issue]).join(" · ")}</p>
                    )}
                    {line.issues.includes("changed") && line.suggestedSale !== null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Verkoop per stuk: {formatCurrency(line.quotedSale)}. Met dezelfde opslag: {formatCurrency(line.suggestedSale)}. Nog niet toegepast.
                      </p>
                    )}
                    {line.calculationId && line.issues.length > 0 && (
                      <Link href={`/calculations/${line.calculationId}`} className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-2">
                        Open live calculatie
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Let op: vervangende systemen, compatibiliteit, arbeidsuren en losse keuzeopties vergen een inhoudelijke controle. Werk bij een verstuurde offerte in een nieuwe conceptversie.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {quote.archivedAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Deze offerte is gearchiveerd. Hij staat niet in de werklijsten en telt niet mee in de cijfers.
          </span>
          <Button variant="outline" size="sm" onClick={() => handleArchive(false)} disabled={archiving}>
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Herstellen
          </Button>
        </div>
      )}

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

      <Dialog open={extendDialogOpen} onOpenChange={(open) => !updatingStatus && setExtendDialogOpen(open)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Offerte verlengen</DialogTitle>
            <DialogDescription className="text-base">
              Offerte {quote.number ?? "Concept"} wordt 14 dagen langer geldig.
              {quote.customer.email ? " Pas de mail aan voordat je verlengt." : " Er wordt geen mail verstuurd."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {quote.customer.email ? (
              <label className="flex items-start gap-3 text-base">
                <input
                  type="checkbox"
                  checked={notifyOnExtend}
                  onChange={(event) => setNotifyOnExtend(event.target.checked)}
                  disabled={updatingStatus}
                  className="mt-1 h-5 w-5 shrink-0 accent-primary"
                />
                <span className="min-w-0">Mail sturen naar {quote.customer.name} (<span className="break-all">{quote.customer.email}</span>)</span>
              </label>
            ) : (
              <p className="text-base text-muted-foreground">Deze klant heeft geen e-mailadres. De offerte wordt zonder mail verlengd.</p>
            )}
            {notifyOnExtend && quote.customer.email && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quote-extend-subject" className="text-base">Onderwerp</Label>
                  <Input
                    id="quote-extend-subject"
                    value={extendSubject}
                    onChange={(event) => setExtendSubject(event.target.value)}
                    maxLength={180}
                    disabled={updatingStatus}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-extend-message" className="text-base">Persoonlijke e-mailtekst</Label>
                  <Textarea
                    id="quote-extend-message"
                    value={extendMessage}
                    onChange={(event) => setExtendMessage(event.target.value)}
                    maxLength={2000}
                    rows={5}
                    disabled={updatingStatus}
                    className="min-h-32 resize-y text-base"
                  />
                  <p className="text-base text-muted-foreground">
                    Aanhef, offertenummer, nieuwe geldigheidsdatum, knop en ondertekening worden automatisch toegevoegd.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)} disabled={updatingStatus} className="text-base">Annuleren</Button>
            <Button onClick={handleConfirmExtend} disabled={updatingStatus || (notifyOnExtend && (!extendSubject.trim() || !extendMessage.trim()))} className="text-base">
              {updatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              {updatingStatus ? "Bezig..." : notifyOnExtend ? "Verlengen en mailen" : "Zonder mail verlengen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share URL display */}
      {shareUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
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

      {!quote.sentAt && ["SENT", "VIEWED", "DECLINED", "EXPIRED"].includes(quote.status) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-amber-800">Verzending niet bevestigd</p>
            <p className="mt-1 text-xs text-amber-700">
              Deze offerte staat op &ldquo;{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}&rdquo;, maar er is geen verzendmoment vastgelegd.
              Waarschijnlijk is hij niet via de app verstuurd. Verstuur hem via &ldquo;Verstuur offerte&rdquo; of markeer hem handmatig als verstuurd.
            </p>
          </CardContent>
        </Card>
      )}

      {quote.sentAt && (
        <div className="rounded-lg border border-border bg-card px-3 py-2">
            <button
              type="button"
              onClick={() => setTimelineOpen((open) => !open)}
              aria-expanded={timelineOpen}
              className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${timelineOpen ? "" : "-rotate-90"}`} />
                Tijdlijn
              </span>
              <span className="text-xs text-slate-400">
                Verstuurd op {formatDateTime(quote.sentAt)}
                {quote.sendCount > 1 ? ` · ${quote.sendCount}x verstuurd` : ""}
                {quote.share?.viewCount ? ` · ${quote.share.viewCount}x bekeken` : " · nog niet geopend"}
              </span>
            </button>
            {timelineOpen && (
              quote.events.length > 0 ? (
                <ol className="mt-3 space-y-2 text-sm">
                  {quote.events.map((event) => (
                    <li key={event.id} className="flex items-start justify-between gap-3 border-t border-border pt-2 first:border-0 first:pt-0">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{EVENT_LABELS[event.type] ?? event.type}</p>
                        {event.detail && <p className="truncate text-xs text-slate-400">{event.detail}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Nog geen activiteit geregistreerd.</p>
              )
            )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Offerteweergave" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                aria-current={activeTab === "view" ? "page" : undefined}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === "view" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4" /> Klantversie
              </button>
              {quote.status !== "ACCEPTED" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  aria-current={activeTab === "edit" ? "page" : undefined}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeTab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-4 w-4" /> Bewerken
                </button>
              )}
              {companySlug === "koolhaas" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("advice")}
                  aria-current={activeTab === "advice" ? "page" : undefined}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeTab === "advice" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4" /> Advies
                </button>
              )}
        </nav>
        </div>

        <section className="min-w-0">
        {activeTab === "view" && (
          <div className="space-y-4">
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

        {activeTab !== "view" && !editorData && (
          <div className="rounded-xl border border-border bg-card p-5 text-base text-foreground">
            {editorError ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>Bewerkgegevens konden niet worden geladen.</span>
                <Button variant="outline" size="sm" onClick={() => setEditorError(false)}>Opnieuw proberen</Button>
              </div>
            ) : "Bewerkgegevens laden..."}
          </div>
        )}

        {activeTab === "edit" && editorData && (
          <QuoteBuilder
            customers={editorData.customers}
            products={editorData.products}
            productSets={editorData.productSets}
            companySlug={companySlug}
            companyName={company?.name ?? ""}
            homeBaseZipCode={homeBaseZipCode}
            travelPricingTiers={travelPricingTiers}
            initialQuote={{ ...quote, number: quote.number ?? "CONCEPT" }}
          />
        )}

        {activeTab === "advice" && companySlug === "koolhaas" && editorData && (
            <AdviceDocumentForm
              quoteId={quote.id}
              products={editorData.products}
              existingDocs={quote.adviceDocuments}
            />
        )}
        </section>
      </div>
    </div>
  );
}
