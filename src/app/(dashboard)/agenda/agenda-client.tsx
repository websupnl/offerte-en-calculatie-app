"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase, CalendarDays, ChevronLeft, ChevronRight, Copy, Link2, Loader2,
  Lock, Plus, RefreshCw, Repeat, Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import type { Scope } from "@/lib/tasks";

type AgendaTask = {
  id: string; title: string; status: string; priority: number;
  dueAt: string; startAt: string | null; endAt: string | null; allDay: boolean;
  companyId: string | null; recurRule: string | null;
  company: { name: string; slug: string } | null;
  project: { id: string; number: string } | null;
};

const HOUR_HEIGHT = 64; // px per uur in het rooster
const DEFAULT_MIN_HOUR = 7;
const DEFAULT_MAX_HOUR = 19;
const MIN_BLOCK_HEIGHT = 22;

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); // maandag als eerste dag
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function weekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString("nl-NL", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "long" }),
  });
  const endLabel = end.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function shortWeekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const part = (date: Date) =>
    date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }).replace(".", "");
  return `${part(start)} – ${part(end)}`;
}

function eventTimeLabel(task: AgendaTask): string {
  const start = new Date(task.startAt ?? task.dueAt);
  const startLabel = start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (!task.endAt) return startLabel;
  const endLabel = new Date(task.endAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${startLabel}–${endLabel}`;
}

type PositionedTask = {
  task: AgendaTask;
  top: number;
  height: number;
  col: number;
  cols: number;
};

function layoutTimedTasks(tasks: AgendaTask[], gridStartMinutes: number, pxPerMinute: number): PositionedTask[] {
  const items = tasks
    .map((task) => {
      const start = new Date(task.startAt ?? task.dueAt);
      const startMin = minutesOfDay(start);
      let endMin = task.endAt ? minutesOfDay(new Date(task.endAt)) : startMin + 30;
      if (endMin <= startMin) endMin = startMin + 30;
      return { task, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const columnEnds: number[] = [];
  const withCol = items.map((item) => {
    let col = columnEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[col] = item.endMin;
    }
    return { ...item, col };
  });
  const cols = columnEnds.length || 1;

  return withCol.map(({ task, startMin, endMin, col }) => ({
    task,
    top: Math.max(0, (startMin - gridStartMinutes) * pxPerMinute),
    height: Math.max(MIN_BLOCK_HEIGHT, (endMin - startMin) * pxPerMinute),
    col,
    cols,
  }));
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeValue(minutes: number): string {
  const clamped = Math.min(23 * 60 + 45, Math.max(0, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

type Project = { id: string; number: string; title: string };

export function AgendaClient({
  tasks: initialTasks,
  feedUrl,
  google,
  projects,
  hasCompany,
}: {
  tasks: AgendaTask[];
  feedUrl: string | null;
  google: { configured: boolean; connected: boolean; since?: string | null };
  projects: Project[];
  hasCompany: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [weekOffset, setWeekOffset] = useState(0);
  const [feed, setFeed] = useState(feedUrl);
  const [busy, setBusy] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ date: Date; minutes: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function openCreateDialog(date: Date, minutes: number) {
    setCreateDefaults({ date, minutes });
  }

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
        const dayTasks = tasks.filter((task) => sameDay(new Date(task.dueAt), day));
        return {
          date: day,
          allDayTasks: dayTasks.filter((task) => task.allDay),
          timedTasks: dayTasks.filter((task) => !task.allDay),
        };
      }),
    [weekStart, tasks],
  );

  const { minHour, maxHour } = useMemo(() => {
    let min = DEFAULT_MIN_HOUR;
    let max = DEFAULT_MAX_HOUR;
    for (const day of days) {
      for (const task of day.timedTasks) {
        const start = new Date(task.startAt ?? task.dueAt);
        const end = task.endAt ? new Date(task.endAt) : start;
        min = Math.min(min, Math.floor(minutesOfDay(start) / 60));
        max = Math.max(max, Math.ceil(minutesOfDay(end) / 60) || max);
      }
    }
    return { minHour: Math.max(0, min), maxHour: Math.min(24, Math.max(max, min + 1)) };
  }, [days]);

  const pxPerMinute = HOUR_HEIGHT / 60;
  const gridStartMinutes = minHour * 60;
  const gridHeight = (maxHour - minHour) * HOUR_HEIGHT;
  const hours = useMemo(
    () => Array.from({ length: maxHour - minHour + 1 }, (_, index) => minHour + index),
    [minHour, maxHour],
  );

  const today = new Date();
  const now = new Date();
  const nowMinutes = minutesOfDay(now);
  const showNowLine = weekOffset === 0 && nowMinutes >= gridStartMinutes && nowMinutes <= minHour * 60 + (maxHour - minHour) * 60;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const targetMinutes = weekOffset === 0 && showNowLine ? Math.max(gridStartMinutes, nowMinutes - 60) : gridStartMinutes;
    node.scrollTop = (targetMinutes - gridStartMinutes) * pxPerMinute;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, minHour, maxHour]);

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

  return (
    <div>
      <PageHeader
        eyebrow="Werkplek"
        title="Agenda"
        description="Je week in één oogopslag, zakelijk en privé bij elkaar."
        actions={
          <Button
            size="sm"
            onClick={() => {
              const base = weekOffset === 0 ? new Date() : new Date(weekStart);
              const minutes = weekOffset === 0
                ? Math.min(Math.max(minutesOfDay(base) + 30, minHour * 60), (maxHour - 1) * 60)
                : 9 * 60;
              openCreateDialog(base, Math.round(minutes / 15) * 15);
            }}
          >
            <Plus className="h-4 w-4" /> Nieuwe afspraak
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Deze week</p>
              <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-950 sm:text-lg">
                <span className="sm:hidden">{shortWeekLabel(weekStart)}</span>
                <span className="hidden sm:inline">{weekLabel(weekStart)}</span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-3 text-[11px] font-semibold text-slate-500 sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full bg-sky-400" /> Zakelijk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full bg-violet-400" /> Privé
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Vorige week"
                  onClick={() => setWeekOffset((value) => value - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset(0)}
                  disabled={weekOffset === 0}
                >
                  Vandaag
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Volgende week"
                  onClick={() => setWeekOffset((value) => value + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </header>

          {/* Dagkoppen */}
          <div className="flex border-b border-slate-100">
            <div className="w-12 shrink-0 sm:w-16" />
            {days.map(({ date }) => {
              const isToday = sameDay(date, today);
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 border-l border-slate-100 py-2.5",
                    isToday && "bg-sky-50/50",
                  )}
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {date.toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", "")}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                      isToday ? "bg-[var(--ws-accent)] text-white" : "text-slate-950",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hele dag */}
          {days.some((day) => day.allDayTasks.length > 0) && (
            <div className="flex border-b border-slate-100">
              <div className="flex w-12 shrink-0 items-center justify-end pr-1.5 sm:w-16 sm:pr-2">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-300">Dag</span>
              </div>
              {days.map(({ date, allDayTasks }) => {
                const isToday = sameDay(date, today);
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "min-w-0 flex-1 space-y-1 border-l border-slate-100 p-1.5",
                      isToday && "bg-sky-50/50",
                    )}
                  >
                    {allDayTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks?task=${task.id}`}
                        className={cn(
                          "block truncate rounded-md px-1.5 py-1 text-[11px] font-semibold",
                          task.status === "DONE" && "text-slate-400 line-through",
                          task.companyId
                            ? "bg-sky-50 text-sky-800 hover:bg-sky-100"
                            : "bg-violet-50 text-violet-800 hover:bg-violet-100",
                        )}
                      >
                        {task.title}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Uurrooster */}
          <div ref={scrollRef} className="max-h-[576px] overflow-y-auto overflow-x-auto">
            <div className="relative flex" style={{ minWidth: 560 }}>
              <div className="sticky left-0 z-10 w-12 shrink-0 bg-white sm:w-16">
                {hours.map((hour, index) => (
                  <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                    {index > 0 && (
                      <span className="absolute -top-2 right-1.5 text-[10px] tabular-nums text-slate-400 sm:right-2">
                        {formatHour(hour)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="relative flex min-w-0 flex-1">
                {/* uurlijnen */}
                <div className="pointer-events-none absolute inset-0">
                  {hours.map((hour, index) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: index * HOUR_HEIGHT }}
                    />
                  ))}
                </div>

                {days.map(({ date, timedTasks }) => {
                  const isToday = sameDay(date, today);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const positioned = layoutTimedTasks(timedTasks, gridStartMinutes, pxPerMinute);
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "group/col relative min-w-0 flex-1 cursor-pointer border-l border-slate-100",
                        isToday ? "bg-sky-50/40 hover:bg-sky-50/70" : isWeekend ? "bg-slate-50/70 hover:bg-slate-100/70" : "bg-white hover:bg-slate-50/60",
                      )}
                      style={{ height: gridHeight }}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const minutes = gridStartMinutes + (event.clientY - rect.top) / pxPerMinute;
                        openCreateDialog(date, Math.round(minutes / 15) * 15);
                      }}
                    >
                      {isToday && showNowLine && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                          style={{ top: (nowMinutes - gridStartMinutes) * pxPerMinute }}
                        >
                          <span className="-ml-1 size-2 shrink-0 rounded-full bg-red-500" />
                          <span className="h-px flex-1 bg-red-500" />
                        </div>
                      )}
                      {positioned.map(({ task, top, height, col, cols }) => (
                        <Link
                          key={task.id}
                          href={`/tasks?task=${task.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className={cn(
                            "absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-accent)]/40",
                            task.status === "DONE"
                              ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                              : task.companyId
                              ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                              : "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
                          )}
                          style={{
                            top,
                            height,
                            left: `calc(${(col / cols) * 100}% + 2px)`,
                            width: `calc(${100 / cols}% - 4px)`,
                          }}
                        >
                          {height >= 36 ? (
                            <>
                              <span className="flex items-center gap-1 font-semibold">
                                {!task.companyId && <Lock className="h-2.5 w-2.5 shrink-0" />}
                                <span className="truncate">{task.title}</span>
                                {task.recurRule && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                              </span>
                              <span className="block truncate opacity-70">{eventTimeLabel(task)}</span>
                            </>
                          ) : (
                            <span className="flex items-center gap-1">
                              {!task.companyId && <Lock className="h-2.5 w-2.5 shrink-0" />}
                              <span className="shrink-0 font-semibold opacity-70">{eventTimeLabel(task).split("–")[0]}</span>
                              <span className="truncate font-semibold">{task.title}</span>
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Koppelingen */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Koppelingen</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CalendarDays className="h-4 w-4 text-slate-400" /> Agendalink
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Alleen-lezen voor Apple, Outlook of een andere agenda-app.
                </p>
              </div>
              <div className="mt-3 shrink-0 sm:mt-0">
                {feed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(feed);
                      toast.success("Link gekopieerd");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Kopieer link
                  </Button>
                ) : (
                  <Button size="sm" onClick={createFeed} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link aanmaken"}
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Link2 className="h-4 w-4 text-slate-400" /> Google Agenda
                  {google.connected && <Badge variant="secondary">Gekoppeld</Badge>}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Taken direct naar Google; privé blijft in een aparte agenda.
                </p>
                {!google.configured && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Google is nog niet ingesteld.
                  </p>
                )}
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0 sm:justify-end">
                {google.configured && google.connected ? (
                  <>
                    <Button size="sm" onClick={syncGoogle} disabled={googleSyncing}>
                      {googleSyncing
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                      Synchroniseer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Google Agenda ontkoppelen"
                      className="text-slate-400 hover:text-red-600"
                      onClick={async () => {
                        await fetch("/api/integrations/google", { method: "DELETE" });
                        toast.success("Koppeling verbroken");
                        location.reload();
                      }}
                    >
                      <Unlink />
                    </Button>
                  </>
                ) : google.configured ? (
                  <Button nativeButton={false} size="sm" render={<a href="/api/integrations/google/connect" />}>
                    <Link2 className="h-4 w-4" /> Koppelen
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <NewEventDialog
        open={createDefaults !== null}
        onOpenChange={(open) => { if (!open) setCreateDefaults(null); }}
        defaults={createDefaults}
        hasCompany={hasCompany}
        projects={projects}
        onCreated={(task) => {
          setTasks((current) => [task, ...current]);
          setCreateDefaults(null);
        }}
      />
    </div>
  );
}

function NewEventDialog({
  open,
  onOpenChange,
  defaults,
  hasCompany,
  projects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: { date: Date; minutes: number } | null;
  hasCompany: boolean;
  projects: Project[];
  onCreated: (task: AgendaTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<Scope>(hasCompany ? "business" : "private");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [projectId, setProjectId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !defaults) return;
    setTitle("");
    setScope(hasCompany ? "business" : "private");
    setAllDay(false);
    setDate(toDateValue(defaults.date));
    setStartTime(toTimeValue(defaults.minutes));
    setEndTime(toTimeValue(defaults.minutes + 60));
    setProjectId("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults?.date, defaults?.minutes]);

  async function submit() {
    if (!title.trim() || !date) return;
    const [year, month, day] = date.split("-").map(Number);
    let dueAt: Date;
    let startAt: Date | null = null;
    let endAt: Date | null = null;

    if (allDay) {
      dueAt = new Date(year, month - 1, day, 0, 0, 0);
    } else {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      startAt = new Date(year, month - 1, day, startHour, startMinute);
      endAt = new Date(year, month - 1, day, endHour, endMinute);
      if (endAt <= startAt) {
        toast.error("Eindtijd moet na de starttijd liggen");
        return;
      }
      dueAt = startAt;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          title: title.trim(),
          allDay,
          dueAt: dueAt.toISOString(),
          startAt: startAt?.toISOString() ?? null,
          endAt: endAt?.toISOString() ?? null,
          projectId: scope === "business" && projectId !== "none" ? projectId : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Toevoegen mislukt");
      if (body.calendarSync?.status === "failed") {
        toast.warning(body.calendarSync.message ?? "Opgeslagen, maar Google Agenda kon niet worden bijgewerkt.");
      }
      onCreated({
        id: body.id,
        title: body.title,
        status: body.status,
        priority: body.priority,
        dueAt: body.dueAt,
        startAt: body.startAt,
        endAt: body.endAt,
        allDay: body.allDay,
        companyId: body.companyId,
        recurRule: body.recurRule,
        company: null,
        project: body.project ? { id: body.project.id, number: body.project.number } : null,
      });
      toast.success("Afspraak toegevoegd");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nieuwe afspraak</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Titel</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Arjan bellen"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && submit()}
            />
          </div>

          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScope("business")}
              disabled={!hasCompany}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-40",
                scope === "business" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Briefcase className="h-3.5 w-3.5" /> Zakelijk
            </button>
            <button
              type="button"
              onClick={() => setScope("private")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                scope === "private" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Lock className="h-3.5 w-3.5" /> Privé
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Datum</Label>
              <Input id="event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="flex items-end pb-1.5">
              <button
                type="button"
                onClick={() => setAllDay((value) => !value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition",
                  allDay ? "border-[var(--ws-accent)] bg-[var(--ws-accent)]/10 text-[var(--ws-accent)]" : "border-slate-200 text-slate-500 hover:border-slate-300",
                )}
              >
                Hele dag
              </button>
            </div>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start">Van</Label>
                <Input id="event-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end">Tot</Label>
                <Input id="event-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </div>
            </div>
          )}

          {scope === "business" && projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(value) => setProjectId(value ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Geen project">
                    {(value: string) => {
                      const project = projects.find((p) => p.id === value);
                      return project ? `${project.number} · ${project.title}` : "Geen project";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.number} · {project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={saving || !title.trim() || !date}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
