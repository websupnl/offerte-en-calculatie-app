"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, FileSignature, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTRACT_PERIOD_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS,
  formatCurrency, formatDate,
} from "@/lib/format";

type ContractEvent = { id: string; type: string; detail: string | null; actor: string | null; createdAt: string };

type Contract = {
  id: string; number: string; title: string; body: string | null; status: string;
  startDate: string | null; endDate: string | null; noticePeriodDays: number | null;
  recurringAmount: string | number | null; recurringPeriod: string | null;
  signedAt: string | null; signedBy: string | null; viewedAt: string | null;
  customer: { id: string; name: string; email: string | null };
  project: { id: string; number: string; title: string } | null;
  events: ContractEvent[];
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Aangemaakt",
  SENT: "Verstuurd",
  VIEWED: "Bekeken door klant",
  SIGNED: "Ondertekend",
  RENEWED: "Verlengd",
  TERMINATED: "Opgezegd",
  NOTE: "Wijziging",
};

export function ContractDetailClient({
  contract: initial,
  signatureUrl,
  shareUrl,
}: {
  contract: Contract;
  signatureUrl: string | null;
  shareUrl: string | null;
}) {
  const router = useRouter();
  const [contract, setContract] = useState(initial);
  const [body, setBody] = useState(initial.body ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(
    ["VERZONDEN", "GETEKEND", "ACTIEF"].includes(initial.status) ? shareUrl : null,
  );

  const locked = Boolean(contract.signedAt);

  async function patch(data: Record<string, unknown>, quiet = false) {
    setSaving(true);
    try {
      const response = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error ?? "Opslaan mislukt");
      setContract((current) => ({ ...current, ...saved }));
      if (!quiet) toast.success("Opgeslagen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      const response = await fetch(`/api/contracts/${contract.id}/send`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Versturen mislukt");
      setLink(result.url);
      setContract((current) => ({ ...current, status: "VERZONDEN" }));
      navigator.clipboard.writeText(result.url).catch(() => {});
      toast.success("Tekenlink klaar en gekopieerd");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    const response = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(result.error ?? "Verwijderen mislukt");
    toast.success("Contract verwijderd");
    router.push("/contracts");
  }

  return (
    <div>
      <PageHeader
        eyebrow={contract.number}
        title={contract.title}
        description={`Voor ${contract.customer.name}`}
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/contracts" />}>
              <ArrowLeft className="h-4 w-4" /> Terug
            </Button>
            {!locked && (
              <Button onClick={send} disabled={sending || !body.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Tekenlink maken
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px] lg:p-8">
        <div className="space-y-5">
          <div className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <Label htmlFor="contract-body" className="text-sm font-bold text-foreground">Contracttekst</Label>
              {locked && <Badge variant="secondary">Vergrendeld — al getekend</Badge>}
            </div>
            <Textarea
              id="contract-body"
              rows={22}
              value={body}
              disabled={locked}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => body !== (contract.body ?? "") && patch({ body }, true)}
              placeholder={"## Wat ik voor je doe\n\n- Onderhoud en updates\n- Back-ups\n\n## Looptijd en opzeggen\n\nHet contract loopt…"}
              className="font-mono text-sm leading-6"
            />
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Markdown: <code># kop</code>, <code>- lijstje</code>, <code>**vet**</code>. Wordt automatisch opgeslagen.
            </p>
          </div>

          {signatureUrl && (
            <div className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <FileSignature className="h-4 w-4 text-muted-foreground" /> Handtekening
              </h2>
              <div className="mt-3 rounded-xl bg-muted/40 p-3">
                <Image src={signatureUrl} alt="Handtekening" width={400} height={160} className="h-auto max-w-full" unoptimized />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {contract.signedBy} · {contract.signedAt ? formatDate(contract.signedAt) : ""}
              </p>
            </div>
          )}

          <div className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
            <h2 className="text-sm font-bold text-foreground">Geschiedenis</h2>
            <div className="mt-3 space-y-2">
              {contract.events.map((event) => (
                <div key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">
                    <strong className="font-semibold">{EVENT_LABELS[event.type] ?? event.type}</strong>
                    {event.detail && <span className="text-muted-foreground"> — {event.detail}</span>}
                    {event.actor && <span className="text-muted-foreground"> · {event.actor}</span>}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Status</span>
              <Badge variant={CONTRACT_STATUS_COLORS[contract.status] ?? "outline"}>
                {CONTRACT_STATUS_LABELS[contract.status]}
              </Badge>
            </div>
            <Select
              value={contract.status}
              onValueChange={(value) => value && patch({ status: value })}
            >
              <SelectTrigger className="mt-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {link && (
            <div className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
              <p className="text-sm font-bold text-foreground">Tekenlink</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Stuur deze zelf door, dan staat er een persoonlijk bericht bij.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 truncate rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground ring-1 ring-slate-200"
                />
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Gekopieerd"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {contract.viewedAt && (
                <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                  Klant heeft &apos;m bekeken op {formatDate(contract.viewedAt)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
            <p className="text-sm font-bold text-foreground">Afspraken</p>
            {contract.recurringAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bedrag</span>
                <strong className="tabular-nums">
                  {formatCurrency(Number(contract.recurringAmount))}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {contract.recurringPeriod ? CONTRACT_PERIOD_LABELS[contract.recurringPeriod] : ""}
                  </span>
                </strong>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c-start" className="text-sm">Ingangsdatum</Label>
              <Input
                id="c-start"
                type="date"
                disabled={locked}
                defaultValue={contract.startDate?.slice(0, 10) ?? ""}
                onChange={(event) => patch({ startDate: event.target.value ? new Date(event.target.value).toISOString() : null }, true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end" className="text-sm">Loopt tot</Label>
              <Input
                id="c-end"
                type="date"
                disabled={locked}
                defaultValue={contract.endDate?.slice(0, 10) ?? ""}
                onChange={(event) => patch({ endDate: event.target.value ? new Date(event.target.value).toISOString() : null }, true)}
              />
            </div>
            {contract.noticePeriodDays !== null && (
              <p className="text-sm text-muted-foreground">
                Opzegtermijn {contract.noticePeriodDays} dagen — je krijgt op tijd een taak.
              </p>
            )}
            {contract.project && (
              <Link
                href={`/projects/${contract.project.id}`}
                className="block truncate rounded-lg bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {contract.project.number} · {contract.project.title}
              </Link>
            )}
          </div>

          {!locked && (
            <Button variant="outline" className="w-full text-red-600 hover:bg-red-50" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Verwijderen
            </Button>
          )}
          {saving && <p className="text-center text-sm text-muted-foreground">Opslaan…</p>}
        </aside>
      </div>
    </div>
  );
}
