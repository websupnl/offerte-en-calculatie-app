"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Copy, Link2, Loader2, Lock, RefreshCw, Repeat, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { describeRecurRule } from "@/lib/calendar/recurrence";

type AgendaTask = {
  id: string; title: string; status: string; priority: number;
  dueAt: string; startAt: string | null; endAt: string | null; allDay: boolean;
  companyId: string | null; recurRule: string | null;
  company: { name: string; slug: string } | null;
  project: { id: string; number: string } | null;
};

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); // maandag als eerste dag
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AgendaClient({
  tasks,
  feedUrl,
  google,
}: {
  tasks: AgendaTask[];
  feedUrl: string | null;
  google: { configured: boolean; connected: boolean; since?: string | null };
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [feed, setFeed] = useState(feedUrl);
  const [busy, setBusy] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return {
          date: day,
          tasks: tasks
            .filter((task) => sameDay(new Date(task.dueAt), day))
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.dueAt.localeCompare(b.dueAt)),
        };
      }),
    [weekStart, tasks],
  );

  async function createFeed() {
    setBusy(true);
    try {
      const response = await fetch("/api/calendar/feed", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error();
      setFeed(body.url);
      toast.success("Agendalink aangemaakt");
    } catch {
      toast.error("Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function syncGoogle() {
    setGoogleSyncing(true);
    try {
      const response = await fetch("/api/integrations/google/sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Synchroniseren mislukt");
      if (body.failed > 0) {
        toast.warning(`${body.synced} taken gesynchroniseerd, ${body.failed} mislukt.`);
      } else {
        toast.success(`${body.synced} taken gesynchroniseerd met Google Agenda.`);
      }
      if (body.limited) {
        toast.info("Er staan nog meer taken klaar; synchroniseer nog een keer.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchroniseren mislukt");
    } finally {
      setGoogleSyncing(false);
    }
  }

  const today = new Date();

  return (
    <div>
      <PageHeader
        eyebrow="Werkplek"
        title="Agenda"
        description="Alles met een datum, zakelijk en privé door elkaar — want je hebt maar één dag."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}>Vorige</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Vandaag</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}>Volgende</Button>
          </div>
        }
      />

      <div className="space-y-5 p-5 lg:p-8">
        <p className="text-sm font-semibold text-slate-500">
          {weekStart.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} –{" "}
          {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map(({ date, tasks: dayTasks }) => {
            const isToday = sameDay(date, today);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex min-h-40 flex-col rounded-2xl p-3 ring-1",
                  isToday ? "bg-white ring-2 ring-[var(--ws-accent)]" : isWeekend ? "bg-slate-50 ring-slate-950/[0.06]" : "bg-white ring-slate-950/[0.06]",
                )}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {date.toLocaleDateString("nl-NL", { weekday: "short" })}
                  </span>
                  <span className={cn("text-lg font-bold", isToday ? "text-[var(--ws-accent)]" : "text-slate-900")}>
                    {date.getDate()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {dayTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks?task=${task.id}`}
                      className={cn(
                        "block rounded-lg px-2 py-1.5 text-xs transition hover:brightness-95",
                        task.status === "DONE"
                          ? "bg-slate-100 text-slate-400 line-through"
                          : task.companyId
                            ? "bg-sky-50 text-sky-900"
                            : "bg-violet-50 text-violet-900",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {!task.companyId && <Lock className="h-2.5 w-2.5 shrink-0" />}
                        {task.recurRule && <Repeat className="h-2.5 w-2.5 shrink-0" />}
                        <span className="truncate font-semibold">{task.title}</span>
                      </span>
                      {!task.allDay && (
                        <span className="mt-0.5 block opacity-70">
                          {new Date(task.startAt ?? task.dueAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                          {task.recurRule && ` · ${describeRecurRule(task.recurRule).toLowerCase()}`}
                        </span>
                      )}
                    </Link>
                  ))}
                  {dayTasks.length === 0 && <p className="text-xs text-slate-300">—</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Koppelingen */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CalendarDays className="h-4 w-4 text-slate-400" /> Abonneren met een agendalink
            </div>
            <p className="mt-1 text-[13px] leading-6 text-slate-500">
              Werkt overal (Google, Apple, Outlook) zonder koppeling. Alleen-lezen, en Google
              ververst zo&apos;n link traag — soms pas na uren. Voor direct bijwerken is de
              Google-koppeling hiernaast beter.
            </p>
            {feed ? (
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={feed}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(feed);
                    toast.success("Link gekopieerd");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button className="mt-3" size="sm" onClick={createFeed} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendalink aanmaken"}
              </Button>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Link2 className="h-4 w-4 text-slate-400" /> Google Calendar
              {google.connected && <Badge variant="default" className="ml-1">Gekoppeld</Badge>}
            </div>
            <p className="mt-1 text-[13px] leading-6 text-slate-500">
              Taken met een datum verschijnen direct in je Google-agenda. Privétaken gaan naar
              een aparte agenda &ldquo;Werkplek — Privé&rdquo;, zodat je ze los kunt kleuren of verbergen.
            </p>
            {!google.configured ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Nog niet ingesteld — <code>GOOGLE_CLIENT_ID</code> en <code>GOOGLE_CLIENT_SECRET</code> ontbreken in de omgeving.
              </p>
            ) : google.connected ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={syncGoogle}
                  disabled={googleSyncing}
                >
                  {googleSyncing
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                  Nu synchroniseren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    await fetch("/api/integrations/google", { method: "DELETE" });
                    toast.success("Koppeling verbroken");
                    location.reload();
                  }}
                >
                  <Unlink className="h-4 w-4" /> Ontkoppelen
                </Button>
              </div>
            ) : (
              <Button nativeButton={false} className="mt-3" size="sm" render={<a href="/api/integrations/google/connect" />}>
                <Check className="h-4 w-4" /> Koppelen met Google
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
