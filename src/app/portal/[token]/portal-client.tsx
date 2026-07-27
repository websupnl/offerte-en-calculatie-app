"use client";

import { useState } from "react";
import {
  CheckCircle2, Clock, FileSignature, FileText, Loader2, MessageSquarePlus,
  Send, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { PORTAL_STATUS_LABELS } from "@/lib/portal-labels";

type Comment = { id: string; body: string; authorName: string; createdAt: string; authorUserId: string | null };
type Feedback = {
  id: string; title: string; description: string | null; status: string;
  createdAt: string; source: string; pin: unknown; comments: Comment[];
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600",
  DOING: "bg-amber-100 text-amber-800",
  WAITING: "bg-sky-100 text-sky-800",
  DONE: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-400",
};

export function PortalClient({
  access,
  company,
  customer,
  project,
  feedback: initialFeedback,
  quotes,
  contracts,
}: {
  access: { name: string | null; canComment: boolean; canUpload: boolean };
  company: { name: string; slug: string; branding: Record<string, string> };
  customer: { id: string; name: string };
  project: { id: string; number: string; title: string; status: string; description: string | null } | null;
  feedback: Feedback[];
  quotes: { id: string; number: string; title: string; status: string; totalIncVat: string; share: { token: string } | null }[];
  contracts: { id: string; number: string; title: string; status: string; shareToken: string | null; signedAt: string | null }[];
}) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  const accent = company.branding?.primaryColor ?? "#0f766e";
  const open = feedback.filter((item) => item.status !== "DONE" && item.status !== "CANCELLED");
  const done = feedback.filter((item) => item.status === "DONE" || item.status === "CANCELLED");

  async function submit() {
    if (title.trim().length < 3) return toast.error("Beschrijf kort wat je bedoelt");
    setSending(true);
    try {
      const response = await fetch("/api/portal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Versturen mislukt");
      setFeedback((current) => [body, ...current]);
      setTitle("");
      setDescription("");
      toast.success("Doorgegeven — je ziet hier vanzelf wanneer het opgepakt is");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
            {company.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            {project ? project.title : customer.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {project
              ? `Project ${project.number} — hier houden we samen bij wat er nog moet gebeuren.`
              : "Hier houden we samen bij wat er nog moet gebeuren."}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-6">
        {/* Nieuwe feedback */}
        {access.canComment && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/[0.06]">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <MessageSquarePlus className="h-4 w-4" style={{ color: accent }} /> Iets doorgeven
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-slate-500">
              Wat je hier zet komt direct bij mij binnen. Je ziet zelf terug wanneer ik ermee bezig ben.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Bijvoorbeeld: logo mag groter op de homepage"
                aria-label="Wat wil je doorgeven?"
              />
              <Textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Eventueel meer uitleg (niet verplicht)"
              />
              <Button onClick={submit} disabled={sending || title.trim().length < 3} style={{ backgroundColor: accent }}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Doorgeven
              </Button>
            </div>
          </section>
        )}

        {/* Openstaand */}
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Loopt nog {open.length > 0 && <span className="opacity-60">{open.length}</span>}
          </h2>
          {open.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 ring-1 ring-slate-950/[0.06]">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />
              Er staat niets open.
            </div>
          ) : (
            <div className="space-y-3">
              {open.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  accent={accent}
                  canComment={access.canComment}
                  onComment={(comment) =>
                    setFeedback((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, comments: [...entry.comments, comment] } : entry,
                      ),
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Afgerond */}
        {done.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Afgerond <span className="opacity-60">{done.length}</span>
            </h2>
            <div className="space-y-2">
              {done.map((item) => (
                <div key={item.id} className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-950/[0.06]">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate text-slate-500 line-through">{item.title}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documenten */}
        {(quotes.length > 0 || contracts.length > 0) && (
          <section>
            <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Documenten</h2>
            <div className="space-y-2">
              {quotes.map((quote) => (
                <a
                  key={quote.id}
                  href={quote.share ? `/q/${quote.share.token}` : "#"}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-950/[0.06]",
                    quote.share ? "hover:ring-slate-950/[0.14]" : "pointer-events-none opacity-60",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{quote.title || quote.number}</span>
                      <span className="block text-xs text-slate-400">Offerte {quote.number}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(Number(quote.totalIncVat))}</span>
                </a>
              ))}
              {contracts.map((contract) => (
                <a
                  key={contract.id}
                  href={contract.shareToken ? `/c/${contract.shareToken}` : "#"}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-950/[0.06]",
                    contract.shareToken ? "hover:ring-slate-950/[0.14]" : "pointer-events-none opacity-60",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileSignature className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{contract.title}</span>
                      <span className="block text-xs text-slate-400">Contract {contract.number}</span>
                    </span>
                  </span>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    contract.signedAt ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                  )}>
                    {contract.signedAt ? "Getekend" : "Nog tekenen"}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="pt-4 text-center text-xs text-slate-400">
          Deze pagina is alleen voor jou. Vragen? Neem gewoon contact op met {company.name}.
        </p>
      </div>
    </main>
  );
}

function FeedbackCard({
  item,
  accent,
  canComment,
  onComment,
}: {
  item: Feedback;
  accent: string;
  canComment: boolean;
  onComment: (comment: Comment) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showReply, setShowReply] = useState(false);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`/api/portal/feedback/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Versturen mislukt");
      onComment(body);
      setReply("");
      setShowReply(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{item.title}</p>
          {item.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[item.status])}>
          {PORTAL_STATUS_LABELS[item.status]}
        </span>
      </div>

      {item.comments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {item.comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm",
                comment.authorUserId ? "bg-slate-50" : "bg-sky-50",
              )}
            >
              <p className="whitespace-pre-wrap leading-6 text-slate-700">{comment.body}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {comment.authorName} ·{" "}
                {new Date(comment.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {canComment && (
        <div className="mt-3">
          {showReply ? (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Reactie…"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={send} disabled={sending || !reply.trim()} style={{ backgroundColor: accent }}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Versturen"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowReply(false)}>Annuleren</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowReply(true)}
              className="text-[13px] font-semibold text-slate-400 hover:text-slate-700"
            >
              Reageren
            </button>
          )}
        </div>
      )}

      {item.status === "DOING" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <Clock className="h-3 w-3" /> Hier wordt nu aan gewerkt.
        </p>
      )}
      {item.source === "PORTAL_PIN" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="h-3 w-3" /> Aangeklikt op de website
        </p>
      )}
    </div>
  );
}
