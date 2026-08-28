"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  FileText,
  GripVertical,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Redo2,
  Save,
  Signature,
  Sparkles,
  SplitSquareVertical,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  createBlockId,
  duplicateDocumentBlock,
  legacyQuoteToDocument,
  parseQuoteDocument,
  quoteDocumentSchema,
  type CalculationSnapshot,
  type QuoteDocument,
  type QuoteDocumentBlock,
} from "@/lib/quote-document";
import {
  QuoteDocumentBlockView,
  type QuoteDocumentRenderData,
} from "@/components/quotes/quote-document-renderer";

type CalculationForBuilder = {
  id: string;
  number: string;
  title: string;
  updatedAt: string;
  totalCostPrice: number;
  totalSalesPrice: number;
  marginAmount: number;
  marginPercent: number;
  vatRate: number;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unit: string;
    costPrice: number;
    unitPrice: number;
    vatRate: number;
    optional: boolean;
    hiddenOnQuote: boolean;
  }>;
};

type QuoteTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  document: unknown;
};

type BuilderQuote = QuoteDocumentRenderData & {
  id: string;
  category?: string | null;
  intro?: string | null;
  outro?: string | null;
  assumptions?: unknown;
  technicalNotes?: unknown;
  customerResponsibilities?: unknown;
  exclusions?: unknown;
  options?: unknown;
  attachments?: Array<{ imageUrl?: string | null; title?: string | null; caption?: string | null }>;
  document?: unknown;
  documentRevision?: number;
  status: string;
};

const ELEMENTS: Array<{
  type: QuoteDocumentBlock["type"];
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  { type: "hero", title: "Intro", description: "Titel en persoonlijke opening", icon: Heading },
  { type: "text", title: "Tekst", description: "Vrij tekstblok met bronnen", icon: FileText },
  { type: "list", title: "Opsomming", description: "Inbegrepen, info of waarschuwing", icon: ListChecks },
  { type: "quoteItems", title: "Offerteregels", description: "Live regels en klantprijzen", icon: CircleDollarSign },
  { type: "choices", title: "Keuzes", description: "Configuraties uit deze offerte", icon: LayoutTemplate },
  { type: "image", title: "Afbeelding", description: "Product, ontwerp of situatie", icon: ImageIcon },
  { type: "signature", title: "Ondertekening", description: "Slottekst en akkoord", icon: Signature },
  { type: "pageBreak", title: "Nieuwe pagina", description: "Handmatig pagina-einde", icon: SplitSquareVertical },
];

export function QuoteDocumentBuilder({
  quote,
  calculations,
  initialTemplates,
  companySlug,
}: {
  quote: BuilderQuote;
  calculations: CalculationForBuilder[];
  initialTemplates: QuoteTemplate[];
  companySlug: string;
}) {
  const initialDocument = useMemo(
    () => parseQuoteDocument(quote.document) ?? legacyQuoteToDocument(quote),
    [quote],
  );
  const [document, setDocument] = useState(initialDocument);
  const [history, setHistory] = useState<QuoteDocument[]>([initialDocument]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error" | "conflict">(
    quote.document ? "saved" : "unsaved",
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(initialDocument.blocks.length);
  const [editingBlock, setEditingBlock] = useState<QuoteDocumentBlock | null>(null);
  const [calculationDialogOpen, setCalculationDialogOpen] = useState(false);
  const [calculationDetailId, setCalculationDetailId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(quote.title || "Nieuwe template");
  const [templates, setTemplates] = useState(initialTemplates);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const documentRef = useRef(document);
  const revisionRef = useRef(quote.documentRevision ?? 0);
  const savedSignatureRef = useRef(quote.document ? JSON.stringify(initialDocument) : "");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { documentRef.current = document; }, [document]);

  useEffect(() => {
    const signature = JSON.stringify(document);
    if (signature === savedSignatureRef.current || saveStatus === "conflict") return;
    setSaveStatus((status) => status === "saving" ? status : "unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void queueSave(documentRef.current), 900);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // queueSave is deliberately stable through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  function commit(next: QuoteDocument) {
    const valid = quoteDocumentSchema.parse(next);
    setDocument(valid);
    setHistory((current) => [...current.slice(0, historyIndex + 1), structuredClone(valid)].slice(-60));
    setHistoryIndex((current) => Math.min(current + 1, 59));
    setSaveStatus("unsaved");
  }

  function queueSave(target: QuoteDocument) {
    const signature = JSON.stringify(target);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (signature === savedSignatureRef.current) return;
      setSaveStatus("saving");
      try {
        const response = await fetch(`/api/quotes/${quote.id}/document`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedRevision: revisionRef.current, document: target }),
        });
        const data = await response.json();
        if (response.status === 409) {
          setSaveStatus("conflict");
          toast.error(data.error || "Deze offerte is elders gewijzigd.");
          return;
        }
        if (!response.ok) throw new Error(data.error || "Opslaan mislukt");
        revisionRef.current = data.documentRevision;
        savedSignatureRef.current = signature;
        setSaveStatus(JSON.stringify(documentRef.current) === signature ? "saved" : "unsaved");
      } catch (error) {
        setSaveStatus("error");
        toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
      }
    });
    return saveQueueRef.current;
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setDocument(structuredClone(history[nextIndex]));
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setDocument(structuredClone(history[nextIndex]));
  }

  function openLibrary(index: number) {
    setInsertIndex(index);
    setLibraryOpen(true);
  }

  function addBlock(type: QuoteDocumentBlock["type"]) {
    if (type === "calculation") {
      setLibraryOpen(false);
      setCalculationDialogOpen(true);
      return;
    }
    const block = createDefaultBlock(type, quote.title || "Persoonlijk voorstel");
    const blocks = [...document.blocks];
    blocks.splice(insertIndex, 0, block);
    commit({ ...document, blocks });
    setLibraryOpen(false);
    if (type !== "pageBreak" && type !== "quoteItems" && type !== "choices") setEditingBlock(block);
  }

  function replaceBlock(block: QuoteDocumentBlock) {
    commit({ ...document, blocks: document.blocks.map((current) => current.id === block.id ? block : current) });
    setEditingBlock(null);
  }

  function editBlock(block: QuoteDocumentBlock) {
    if (block.type === "calculation") {
      setCalculationDetailId(block.snapshot.calculationId);
      return;
    }
    setEditingBlock(structuredClone(block));
  }

  function removeBlock(id: string) {
    commit({ ...document, blocks: document.blocks.filter((block) => block.id !== id) });
  }

  function duplicateBlock(id: string) {
    const index = document.blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const blocks = [...document.blocks];
    blocks.splice(index + 1, 0, duplicateDocumentBlock(blocks[index]));
    commit({ ...document, blocks });
  }

  function moveBlock(id: string, targetIndex: number) {
    const index = document.blocks.findIndex((block) => block.id === id);
    if (index < 0 || index === targetIndex) return;
    const blocks = [...document.blocks];
    const [block] = blocks.splice(index, 1);
    blocks.splice(Math.max(0, Math.min(targetIndex, blocks.length)), 0, block);
    commit({ ...document, blocks });
  }

  function addCalculation(calculation: CalculationForBuilder) {
    const block: QuoteDocumentBlock = {
      id: createBlockId("calculation"),
      type: "calculation",
      title: calculation.title,
      description: "Levering en uitvoering volgens de gekoppelde calculatie.",
      snapshot: snapshotCalculation(calculation),
      showItems: true,
    };
    const blocks = [...document.blocks];
    blocks.splice(insertIndex, 0, block);
    commit({ ...document, blocks });
    setCalculationDialogOpen(false);
    setCalculationDetailId(calculation.id);
  }

  function syncCalculation(blockId: string, calculation: CalculationForBuilder) {
    const block = document.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.type !== "calculation") return;
    replaceBlock({ ...block, snapshot: snapshotCalculation(calculation) });
    toast.success("Calculatie opnieuw gesynchroniseerd");
  }

  async function saveAsTemplate() {
    if (templateName.trim().length < 2) return toast.error("Geef het template een naam");
    const response = await fetch("/api/quote-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName.trim(), category: quote.category || undefined, document }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Template opslaan mislukt");
    setTemplates((current) => [data, ...current]);
    setSaveTemplateOpen(false);
    toast.success("Template opgeslagen");
  }

  function applyTemplate(template: QuoteTemplate) {
    const parsed = parseQuoteDocument(template.document);
    if (!parsed) return toast.error("Dit template kan niet worden geopend");
    commit({ ...parsed, blocks: parsed.blocks.map(duplicateDocumentBlock) });
    setTemplateDialogOpen(false);
    toast.success(`${template.name} toegepast`);
  }

  async function generateWithAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/extract-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, customerName: quote.customer.name, intent: "quoteImport" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "AI-opzet mislukt");
      const aiQuote = data.quote ?? data;
      commit(legacyQuoteToDocument({ ...aiQuote, items: aiQuote.items ?? quote.items }));
      setAiDialogOpen(false);
      setAiPrompt("");
      toast.success("AI-opzet als bewerkbare elementen geladen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI-opzet mislukt");
    } finally {
      setAiLoading(false);
    }
  }

  const isKoolhaas = companySlug === "koolhaas";
  return (
    <div className="min-h-[70vh] rounded-2xl bg-slate-100/70 p-3 sm:p-5">
      <div className="sticky top-2 z-30 mx-auto mb-5 flex max-w-[980px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} aria-label="Ongedaan maken"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} aria-label="Opnieuw"><Redo2 className="h-4 w-4" /></Button>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Button variant="ghost" size="sm" onClick={() => setTemplateDialogOpen(true)}><LayoutTemplate className="mr-1.5 h-4 w-4" />Templates</Button>
          <Button variant="ghost" size="sm" onClick={() => setAiDialogOpen(true)}><Sparkles className="mr-1.5 h-4 w-4 text-violet-600" />AI-opzet</Button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SaveState status={saveStatus} />
          <Button size="sm" onClick={() => void queueSave(documentRef.current)} disabled={saveStatus === "saving" || saveStatus === "saved" || saveStatus === "conflict"}>
            {saveStatus === "saving" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Opslaan
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[880px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
        <div className={`h-1.5 ${isKoolhaas ? "bg-[#147f88]" : "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500"}`} />
        <div className="px-5 py-8 sm:px-12 sm:py-10">
          <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-4 text-xs text-slate-400">
            <span className="font-semibold text-slate-700">{quote.company?.name || "Offerte"}</span>
            <span>{quote.number} · {quote.customer.name}</span>
          </div>
          <button type="button" onClick={() => openLibrary(0)} aria-label="Element bovenaan toevoegen" className="group mb-3 flex w-full items-center gap-3 text-xs text-slate-300 hover:text-slate-600">
            <span className="h-px flex-1 bg-slate-200" /><span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-slate-300 bg-white group-hover:border-slate-500"><Plus className="h-3.5 w-3.5" /></span><span className="h-px flex-1 bg-slate-200" />
          </button>
          {document.blocks.map((block, index) => (
            <div key={block.id}>
              {block.type === "pageBreak" ? (
                <div className="group relative my-7 flex items-center gap-3 py-3" draggable onDragStart={() => setDraggingId(block.id)} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && moveBlock(draggingId, index)}>
                  <span className="h-px flex-1 border-t border-dashed border-slate-300" /><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Nieuwe pagina</span><span className="h-px flex-1 border-t border-dashed border-slate-300" />
                  <BlockToolbar block={block} index={index} count={document.blocks.length} onEdit={editBlock} onMove={moveBlock} onDuplicate={duplicateBlock} onRemove={removeBlock} />
                </div>
              ) : (
                <div
                  className={`group relative rounded-2xl border border-transparent px-2 py-4 transition ${draggingId === block.id ? "opacity-40" : "hover:border-blue-200 hover:bg-blue-50/20"}`}
                  draggable
                  onDragStart={() => setDraggingId(block.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggingId && moveBlock(draggingId, index)}
                  onDoubleClick={() => editBlock(block)}
                >
                  <QuoteDocumentBlockView block={block} quote={quote} isKoolhaas={isKoolhaas} />
                  <BlockToolbar block={block} index={index} count={document.blocks.length} onEdit={editBlock} onMove={moveBlock} onDuplicate={duplicateBlock} onRemove={removeBlock} />
                </div>
              )}
              <button type="button" onClick={() => openLibrary(index + 1)} aria-label={`Element na positie ${index + 1} toevoegen`} className="group my-2 flex w-full items-center gap-3 text-xs text-slate-300 hover:text-slate-600">
                <span className="h-px flex-1 bg-transparent group-hover:bg-slate-200" /><span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-transparent bg-white group-hover:border-slate-300"><Plus className="h-3.5 w-3.5" /></span><span className="h-px flex-1 bg-transparent group-hover:bg-slate-200" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ElementLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} onAdd={addBlock} onCalculation={() => addBlock("calculation")} />
      {editingBlock && <BlockEditDialog block={editingBlock} onOpenChange={(open) => !open && setEditingBlock(null)} onSave={replaceBlock} />}
      <CalculationPickerDialog open={calculationDialogOpen} onOpenChange={setCalculationDialogOpen} calculations={calculations} onSelect={addCalculation} />
      <CalculationDetailDialog
        calculation={calculations.find((item) => item.id === calculationDetailId) ?? null}
        block={document.blocks.find((block) => block.type === "calculation" && block.snapshot.calculationId === calculationDetailId) as Extract<QuoteDocumentBlock, { type: "calculation" }> | undefined}
        onOpenChange={(open) => !open && setCalculationDetailId(null)}
        onSync={syncCalculation}
      />
      <TemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} templates={templates} onApply={applyTemplate} onSave={() => { setTemplateDialogOpen(false); setSaveTemplateOpen(true); }} />
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Opslaan als template</DialogTitle><DialogDescription>Calculatiekoppelingen worden bewust niet in het template opgenomen.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Naam</Label><Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Annuleren</Button><Button onClick={() => void saveAsTemplate()}>Template opslaan</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Offerte met AI opzetten</DialogTitle><DialogDescription>AI maakt gewone, verplaatsbare elementen. U houdt altijd controle over het resultaat.</DialogDescription></DialogHeader><Textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={8} placeholder="Beschrijf klantwens, producten, prijzen en aandachtspunten…" /><DialogFooter><Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={aiLoading}>Annuleren</Button><Button onClick={() => void generateWithAi()} disabled={aiLoading || !aiPrompt.trim()}>{aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Opzet maken</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function SaveState({ status }: { status: "saved" | "unsaved" | "saving" | "error" | "conflict" }) {
  if (status === "saving") return <span className="flex items-center gap-1.5 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Opslaan…</span>;
  if (status === "saved") return <span className="flex items-center gap-1.5 text-emerald-700"><Check className="h-3.5 w-3.5" />Opgeslagen</span>;
  if (status === "conflict") return <span className="text-rose-700">Versieconflict · vernieuw</span>;
  if (status === "error") return <span className="text-rose-700">Opslaan mislukt</span>;
  return <span className="text-amber-700">Niet opgeslagen</span>;
}

function BlockToolbar({ block, index, count, onEdit, onMove, onDuplicate, onRemove }: {
  block: QuoteDocumentBlock;
  index: number;
  count: number;
  onEdit: (block: QuoteDocumentBlock) => void;
  onMove: (id: string, index: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-lg sm:hidden sm:group-hover:flex sm:group-focus-within:flex">
      <span className="cursor-grab px-1.5 text-slate-300" title="Slepen"><GripVertical className="h-4 w-4" /></span>
      {block.type !== "pageBreak" && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(block)}>Bewerken</Button>}
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(block.id, index - 1)} aria-label="Omhoog"><ArrowUp className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === count - 1} onClick={() => onMove(block.id, index + 1)} aria-label="Omlaag"><ArrowDown className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(block.id)} aria-label="Dupliceren"><Copy className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700" onClick={() => onRemove(block.id)} aria-label="Verwijderen"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function ElementLibraryDialog({ open, onOpenChange, onAdd, onCalculation }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: (type: QuoteDocumentBlock["type"]) => void; onCalculation: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Element toevoegen</DialogTitle><DialogDescription>Kies alleen wat op deze plek nodig is. Alle elementen blijven later verplaatsbaar.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {ELEMENTS.map((element) => { const Icon = element.icon; return <button key={element.type} type="button" onClick={() => onAdd(element.type)} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-slate-900">{element.title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{element.description}</span></span></button>; })}
          <button type="button" onClick={onCalculation} className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-left transition hover:border-emerald-400"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Link2 className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-slate-900">Gekoppelde calculatie</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Klantprijs gekoppeld aan inkoop en marge</span></span></button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlockEditDialog({ block, onOpenChange, onSave }: { block: QuoteDocumentBlock; onOpenChange: (open: boolean) => void; onSave: (block: QuoteDocumentBlock) => void }) {
  const [draft, setDraft] = useState<QuoteDocumentBlock | null>(block);
  if (!draft) return <Dialog open={false}><DialogContent /></Dialog>;
  const set = (updates: Partial<QuoteDocumentBlock>) => setDraft({ ...draft, ...updates } as QuoteDocumentBlock);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Element bewerken</DialogTitle><DialogDescription>Alleen de instellingen van dit element staan hier, zodat het document rustig blijft.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {draft.type === "hero" && <><Field label="Bovenregel"><Input value={draft.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></Field><Field label="Titel"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Intro"><Textarea rows={7} value={draft.text} onChange={(e) => set({ text: e.target.value })} /></Field></>}
          {draft.type === "text" && <><Field label="Titel (optioneel)"><Input value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Tekst"><Textarea rows={10} value={draft.text} onChange={(e) => set({ text: e.target.value })} /></Field><Field label="Weergave"><select value={draft.tone} onChange={(e) => set({ tone: e.target.value as "plain" | "accent" | "note" })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="plain">Normaal</option><option value="accent">Uitgelicht</option><option value="note">Notitie</option></select></Field><SourcesEditor block={draft} onChange={(sources) => set({ sources })} /></>}
          {draft.type === "list" && <><Field label="Titel"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Regels (één per regel)"><Textarea rows={9} value={draft.items.join("\n")} onChange={(e) => set({ items: e.target.value.split("\n").filter(Boolean) })} /></Field><Field label="Stijl"><select value={draft.tone} onChange={(e) => set({ tone: e.target.value as "check" | "info" | "warning" })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="check">Vinkjes</option><option value="info">Informatie</option><option value="warning">Niet inbegrepen / waarschuwing</option></select></Field></>}
          {draft.type === "quoteItems" && <><Field label="Titel"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.showPrices} onChange={(e) => set({ showPrices: e.target.checked })} />Prijzen tonen</label></>}
          {draft.type === "choices" && <Field label="Titel"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>}
          {draft.type === "calculation" && <><Field label="Titel voor klant"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Toelichting"><Textarea rows={5} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.showItems} onChange={(e) => set({ showItems: e.target.checked })} />Calculatieregels tonen</label><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-bold">{draft.snapshot.number} · {draft.snapshot.title}</p><p className="mt-1 text-xs">Momentopname van {new Date(draft.snapshot.syncedAt).toLocaleString("nl-NL")}</p></div></>}
          {draft.type === "image" && <><Field label="Afbeeldings-URL"><Input value={draft.url} onChange={(e) => set({ url: e.target.value })} /></Field><Field label="Alt-tekst"><Input value={draft.alt} onChange={(e) => set({ alt: e.target.value })} /></Field><Field label="Bijschrift"><Textarea rows={3} value={draft.caption} onChange={(e) => set({ caption: e.target.value })} /></Field></>}
          {draft.type === "signature" && <><Field label="Titel"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Slottekst"><Textarea rows={6} value={draft.text} onChange={(e) => set({ text: e.target.value })} /></Field></>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button><Button onClick={() => onSave(draft)}>Wijzigingen toepassen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourcesEditor({ block, onChange }: { block: Extract<QuoteDocumentBlock, { type: "text" }>; onChange: (sources: Extract<QuoteDocumentBlock, { type: "text" }>["sources"]) => void }) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><Label>Bronnen</Label><Button type="button" variant="outline" size="sm" onClick={() => onChange([...block.sources, { id: createBlockId("source"), label: "Bron", url: "https://voorbeeld.nl" }])}><Plus className="mr-1 h-3.5 w-3.5" />Bron</Button></div>{block.sources.map((source, index) => <div key={source.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto]"><Input value={source.label} placeholder="Naam" onChange={(e) => onChange(block.sources.map((item, itemIndex) => itemIndex === index ? { ...item, label: e.target.value } : item))} /><Input value={source.url} placeholder="https://…" onChange={(e) => onChange(block.sources.map((item, itemIndex) => itemIndex === index ? { ...item, url: e.target.value } : item))} /><Button variant="ghost" size="icon" onClick={() => onChange(block.sources.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }

function CalculationPickerDialog({ open, onOpenChange, calculations, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; calculations: CalculationForBuilder[]; onSelect: (calculation: CalculationForBuilder) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Calculatie koppelen</DialogTitle><DialogDescription>De klantprijs wordt als veilige momentopname geplaatst. Interne kostprijzen blijven uitsluitend hier zichtbaar.</DialogDescription></DialogHeader><div className="max-h-[55vh] space-y-2 overflow-y-auto">{calculations.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nog geen beschikbare calculaties.</div> : calculations.map((calculation) => <button key={calculation.id} type="button" onClick={() => onSelect(calculation)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/40"><span><span className="block text-sm font-bold text-slate-900">{calculation.title}</span><span className="mt-1 block text-xs text-slate-500">{calculation.number} · {calculation.items.length} regels · {calculation.marginPercent.toFixed(1)}% marge</span></span><span className="flex items-center gap-3"><strong className="text-sm">{formatCurrency(calculation.totalSalesPrice * (1 + calculation.vatRate / 100))}</strong><ChevronRight className="h-4 w-4 text-slate-400" /></span></button>)}</div></DialogContent></Dialog>;
}

function CalculationDetailDialog({ calculation, block, onOpenChange, onSync }: { calculation: CalculationForBuilder | null; block?: Extract<QuoteDocumentBlock, { type: "calculation" }>; onOpenChange: (open: boolean) => void; onSync: (blockId: string, calculation: CalculationForBuilder) => void }) {
  if (!calculation) return <Dialog open={false}><DialogContent /></Dialog>;
  const stale = block ? new Date(calculation.updatedAt).getTime() > new Date(block.snapshot.syncedAt).getTime() : false;
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{calculation.title}</DialogTitle><DialogDescription>{calculation.number} · Interne calculatiedetails, niet zichtbaar voor de klant.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-4"><Metric label="Inkoop" value={formatCurrency(calculation.totalCostPrice)} /><Metric label="Verkoop excl." value={formatCurrency(calculation.totalSalesPrice)} /><Metric label="Brutowinst" value={formatCurrency(calculation.marginAmount)} accent /><Metric label="Marge" value={`${calculation.marginPercent.toFixed(1)}%`} accent /></div><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Omschrijving</th><th className="px-4 py-3 text-right">Aantal</th><th className="px-4 py-3 text-right">Inkoop</th><th className="px-4 py-3 text-right">Verkoop</th></tr></thead><tbody className="divide-y">{calculation.items.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.description}</td><td className="px-4 py-3 text-right">{item.qty} {item.unit}</td><td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.qty * item.costPrice)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.qty * item.unitPrice)}</td></tr>)}</tbody></table></div><DialogFooter>{stale && <span className="mr-auto flex items-center gap-2 text-sm text-amber-700"><CircleDollarSign className="h-4 w-4" />Nieuwere calculatie beschikbaar</span>}<Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>{block && <Button onClick={() => onSync(block.id, calculation)} disabled={!stale}>{stale ? "Wijzigingen synchroniseren" : "Momentopname is actueel"}</Button>}</DialogFooter></DialogContent></Dialog>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className={`rounded-xl border p-4 ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${accent ? "text-emerald-800" : "text-slate-900"}`}>{value}</p></div>; }

function TemplateDialog({ open, onOpenChange, templates, onApply, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; templates: QuoteTemplate[]; onApply: (template: QuoteTemplate) => void; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Offertetemplates</DialogTitle><DialogDescription>Start vanuit een herbruikbare structuur of bewaar deze offerte als nieuw template.</DialogDescription></DialogHeader><div className="max-h-[55vh] space-y-2 overflow-y-auto">{templates.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nog geen eigen templates. Bewaar deze opzet als eerste template.</div> : templates.map((template) => <button key={template.id} type="button" onClick={() => onApply(template)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/40"><span><span className="block text-sm font-bold">{template.name}</span><span className="mt-1 block text-xs text-slate-500">{template.category || "Algemeen"}{template.description ? ` · ${template.description}` : ""}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}</div><DialogFooter><Button onClick={onSave}><Save className="mr-2 h-4 w-4" />Huidige opzet bewaren</Button></DialogFooter></DialogContent></Dialog>;
}

function snapshotCalculation(calculation: CalculationForBuilder): CalculationSnapshot {
  return {
    calculationId: calculation.id,
    number: calculation.number,
    title: calculation.title,
    syncedAt: calculation.updatedAt,
    totalSalesPrice: calculation.totalSalesPrice,
    vatRate: calculation.vatRate,
    items: calculation.items.map((item) => ({
      id: item.id,
      description: item.description,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      optional: item.optional,
      hiddenOnQuote: item.hiddenOnQuote,
    })),
  };
}

function createDefaultBlock(type: QuoteDocumentBlock["type"], quoteTitle: string): QuoteDocumentBlock {
  if (type === "hero") return { id: createBlockId("hero"), type, eyebrow: "Persoonlijk voorstel", title: quoteTitle, text: "Korte persoonlijke toelichting." };
  if (type === "text") return { id: createBlockId("text"), type, title: "Nieuw tekstblok", text: "Schrijf hier de uitleg voor de klant.", tone: "plain", sources: [] };
  if (type === "list") return { id: createBlockId("list"), type, title: "Wat is inbegrepen", items: ["Eerste onderdeel"], tone: "check" };
  if (type === "quoteItems") return { id: createBlockId("items"), type, title: "Levering en werkzaamheden", showPrices: true };
  if (type === "choices") return { id: createBlockId("choices"), type, title: "Kies de uitvoering die bij u past" };
  if (type === "image") return { id: createBlockId("image"), type, url: "/logos/koolhaas-logo.png", alt: "Afbeelding bij de offerte", caption: "" };
  if (type === "signature") return { id: createBlockId("signature"), type, title: "Klaar om te starten?", text: "Vragen of aanpassingen zijn altijd welkom." };
  if (type === "pageBreak") return { id: createBlockId("page"), type };
  throw new Error("Kies eerst een calculatie");
}
