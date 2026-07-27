"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Check, CheckCircle2, ChevronRight, Inbox, ListTodo, Loader2, Lock,
  MessageSquare, Plus, Search, ShoppingCart, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type Scope, parseQuickAdd,
} from "@/lib/tasks";

type TaskList = {
  id: string; name: string; kind: string; icon: string | null; color: string | null;
  _count: { tasks: number };
};

type Task = {
  id: string; title: string; description: string | null; status: string; priority: number;
  dueAt: string | null; startAt: string | null; allDay: boolean; listId: string | null;
  list: { id: string; name: string; kind: string } | null;
  project: { id: string; number: string; title: string } | null;
  customer: { id: string; name: string } | null;
  _count: { comments: number; attachments: number };
};

type Comment = { id: string; body: string; authorName: string; createdAt: string; visibility: string };

const PRIORITY_DOT: Record<number, string> = {
  0: "bg-slate-300",
  1: "bg-amber-500",
  2: "bg-red-500",
};

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Groepeert op urgentie in plaats van op datum — dat is hoe je 's ochtends kijkt. */
function bucketOf(task: Task, now: Date): string {
  if (!task.dueAt) return "Zonder datum";
  const due = startOfDay(new Date(task.dueAt));
  const today = startOfDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Te laat";
  if (days === 0) return "Vandaag";
  if (days === 1) return "Morgen";
  if (days <= 7) return "Deze week";
  return "Later";
}

const BUCKET_ORDER = ["Te laat", "Vandaag", "Morgen", "Deze week", "Later", "Zonder datum"];

function formatDue(task: Task): string {
  if (!task.dueAt) return "";
  const d = new Date(task.dueAt);
  return d.toLocaleDateString("nl-NL", {
    weekday: "short", day: "numeric", month: "short",
    ...(task.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function TasksClient({
  initialTasks,
  initialLists,
  projects,
  hasCompany,
}: {
  initialTasks: Task[];
  initialLists: TaskList[];
  projects: { id: string; number: string; title: string }[];
  hasCompany: boolean;
}) {
  const [scope, setScope] = useState<Scope>(hasCompany ? "business" : "private");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [lists, setLists] = useState<TaskList[]>(initialLists);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  const loadedOnce = useRef(true);

  const reload = useCallback(async (nextScope: Scope, includeDone: boolean) => {
    setLoading(true);
    try {
      const query = `scope=${nextScope}${includeDone ? "&includeDone=1" : ""}`;
      const [taskRes, listRes] = await Promise.all([
        fetch(`/api/tasks?${query}`),
        fetch(`/api/task-lists?scope=${nextScope}`),
      ]);
      if (!taskRes.ok || !listRes.ok) throw new Error("Laden mislukt");
      setTasks(await taskRes.json());
      setLists(await listRes.json());
    } catch {
      toast.error("Kon taken niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  // Eerste render gebruikt de server-data; daarna pas fetchen.
  useEffect(() => {
    if (loadedOnce.current) {
      loadedOnce.current = false;
      return;
    }
    setActiveListId(null);
    reload(scope, showDone);
  }, [scope, showDone, reload]);

  const preview = useMemo(() => (quick.trim() ? parseQuickAdd(quick) : null), [quick]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (activeListId && task.listId !== activeListId) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, activeListId, search]);

  const grouped = useMemo(() => {
    const now = new Date();
    const map = new Map<string, Task[]>();
    for (const task of visible) {
      const bucket = task.status === "DONE" || task.status === "CANCELLED" ? "Afgerond" : bucketOf(task, now);
      map.set(bucket, [...(map.get(bucket) ?? []), task]);
    }
    return [...BUCKET_ORDER, "Afgerond"]
      .filter((bucket) => map.has(bucket))
      .map((bucket) => [bucket, map.get(bucket)!] as const);
  }, [visible]);

  async function addTask() {
    const text = quick.trim();
    if (!text) return;
    setAdding(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, quickAdd: text, listId: activeListId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Toevoegen mislukt");
      setTasks((current) => [body, ...current]);
      setQuick("");
      quickRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen mislukt");
    } finally {
      setAdding(false);
    }
  }

  async function patchTask(id: string, data: Record<string, unknown>) {
    const previous = tasks;
    // Optimistisch bijwerken — aanvinken moet direct voelen.
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...data } as Task : task)));
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Opslaan mislukt");
      setTasks((current) => current.map((task) => (task.id === id ? body : task)));
      setOpenTask((current) => (current?.id === id ? body : current));
    } catch (error) {
      setTasks(previous);
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    }
  }

  async function toggleDone(task: Task) {
    const next = task.status === "DONE" ? "OPEN" : "DONE";
    await patchTask(task.id, { status: next });
    if (next === "DONE" && !showDone) {
      // Even laten zien dat 'ie afgevinkt is, dan pas uit de lijst halen.
      setTimeout(() => setTasks((current) => current.filter((item) => item.id !== task.id)), 700);
    }
  }

  async function removeTask(id: string) {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));
    setOpenTask(null);
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Taak verwijderd");
    } catch {
      setTasks(previous);
      toast.error("Verwijderen mislukt");
    }
  }

  const openCount = tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;

  return (
    <div>
      <PageHeader
        eyebrow="Werkplek"
        title="Taken"
        description={
          scope === "private"
            ? "Je privélijstjes. Deze hangen aan jou, niet aan een bedrijf — en zijn nergens in een zakelijk overzicht te zien."
            : "Alles wat open staat binnen het actieve bedrijf."
        }
        actions={
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScope("business")}
              disabled={!hasCompany}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-40",
                scope === "business" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Briefcase className="h-3.5 w-3.5" /> Zakelijk
            </button>
            <button
              type="button"
              onClick={() => setScope("private")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                scope === "private" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Lock className="h-3.5 w-3.5" /> Privé
            </button>
          </div>
        }
      />

      <div className="space-y-5 p-5 lg:p-8">
        {/* Quick-add */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0 text-slate-400" />
            <Input
              ref={quickRef}
              value={quick}
              onChange={(event) => setQuick(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addTask();
                }
              }}
              placeholder="morgen 10:00 Arjan bellen"
              className="border-0 px-0 text-[15px] shadow-none focus-visible:ring-0"
              aria-label="Nieuwe taak"
            />
            <Button onClick={addTask} disabled={adding || !quick.trim()} size="sm">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Toevoegen"}
            </Button>
          </div>
          <p className="mt-2 pl-6 text-xs text-slate-400">
            {preview ? (
              <span className="text-slate-600">
                <strong className="font-semibold text-slate-900">{preview.title}</strong>
                {preview.dueAt && (
                  <> · {preview.dueAt.toLocaleDateString("nl-NL", {
                    weekday: "short", day: "numeric", month: "short",
                    ...(preview.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
                  })}</>
                )}
                {preview.priority > 0 && <> · {PRIORITY_LABELS[preview.priority].toLowerCase()}</>}
              </span>
            ) : (
              <>Typ gewoon je zin — &ldquo;vrijdag&rdquo;, &ldquo;morgen 10:00&rdquo;, &ldquo;12 maart&rdquo; en &ldquo;!&rdquo; voor hoge prioriteit worden herkend.</>
            )}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          {/* Lijsten */}
          <aside className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveListId(null)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition",
                activeListId === null ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Alles</span>
              <span className="text-xs tabular-nums opacity-70">{openCount}</span>
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setActiveListId(list.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition",
                  activeListId === list.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {list.kind === "SHOPPING" ? <ShoppingCart className="h-4 w-4 shrink-0" /> : <ListTodo className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{list.name}</span>
                </span>
                <span className="text-xs tabular-nums opacity-70">{list._count.tasks}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setListDialogOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <Plus className="h-4 w-4" /> Nieuwe lijst
            </button>
          </aside>

          {/* Taken */}
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Zoeken"
                  className="pl-9"
                  aria-label="Taken zoeken"
                />
              </div>
              <Button variant={showDone ? "default" : "outline"} size="sm" onClick={() => setShowDone((value) => !value)}>
                <CheckCircle2 className="h-4 w-4" /> Afgerond
              </Button>
            </div>

            {loading ? (
              <div className="grid min-h-40 place-items-center rounded-2xl bg-white ring-1 ring-slate-950/[0.06]">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : grouped.length === 0 ? (
              <div className="grid min-h-40 place-items-center rounded-2xl bg-white text-center text-sm text-slate-400 ring-1 ring-slate-950/[0.06]">
                <div>
                  <ListTodo className="mx-auto mb-2 h-8 w-8" />
                  {search ? "Niets gevonden." : "Niets open. Typ hierboven om iets toe te voegen."}
                </div>
              </div>
            ) : (
              grouped.map(([bucket, items]) => (
                <div key={bucket}>
                  <h2 className={cn(
                    "mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em]",
                    bucket === "Te laat" ? "text-red-600" : "text-slate-400",
                  )}>
                    {bucket} <span className="opacity-60">{items.length}</span>
                  </h2>
                  <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
                    {items.map((task, index) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5 transition hover:bg-slate-50",
                          index > 0 && "border-t border-slate-100",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDone(task)}
                          aria-label={task.status === "DONE" ? "Heropenen" : "Afvinken"}
                          className={cn(
                            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                            task.status === "DONE"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 hover:border-slate-500",
                          )}
                        >
                          {task.status === "DONE" && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenTask(task)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className={cn(
                            "truncate text-[15px] font-medium text-slate-900",
                            task.status === "DONE" && "text-slate-400 line-through",
                          )}>
                            {task.priority > 0 && (
                              <span
                                className={cn("mr-1.5 inline-block h-2 w-2 rounded-full align-middle", PRIORITY_DOT[task.priority])}
                                title={PRIORITY_LABELS[task.priority]}
                              />
                            )}
                            {task.title}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                            {task.dueAt && (
                              <span className={cn(bucket === "Te laat" && "font-semibold text-red-600")}>
                                {formatDue(task)}
                              </span>
                            )}
                            {task.list && <span>· {task.list.name}</span>}
                            {task.project && <span>· {task.project.number}</span>}
                            {task._count.comments > 0 && (
                              <span className="flex items-center gap-1">
                                · <MessageSquare className="h-3 w-3" /> {task._count.comments}
                              </span>
                            )}
                          </div>
                        </button>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {openTask && (
      <TaskSheet
        key={openTask.id}
        task={openTask}
        lists={lists}
        projects={scope === "business" ? projects : []}
        onClose={() => setOpenTask(null)}
        onPatch={patchTask}
        onDelete={removeTask}
      />
      )}

      <NewListDialog
        open={listDialogOpen}
        scope={scope}
        onOpenChange={setListDialogOpen}
        onCreated={(list) => setLists((current) => [...current, list])}
      />
    </div>
  );
}

function TaskSheet({
  task,
  lists,
  projects,
  onClose,
  onPatch,
  onDelete,
}: {
  task: Task;
  lists: TaskList[];
  projects: { id: string; number: string; title: string }[];
  onClose: () => void;
  onPatch: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  // Deze sheet krijgt een key op task.id van de ouder, dus per taak een verse
  // mount — daarom mag de beginwaarde gewoon uit de props komen.
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [description, setDescription] = useState(task.description ?? "");
  const [loadingComments, setLoadingComments] = useState(true);

  const taskId = task.id;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled) setComments(body?.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const dueValue = task.dueAt
    ? new Date(new Date(task.dueAt).getTime() - new Date(task.dueAt).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, task.allDay ? 10 : 16)
    : "";

  async function addComment() {
    if (!task || !commentBody.trim()) return;
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error();
      setComments((current) => [...current, body]);
      setCommentBody("");
    } catch {
      toast.error("Reactie plaatsen mislukt");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left leading-snug">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={task.status} onValueChange={(value) => onPatch(task.id, { status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{TASK_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioriteit</Label>
              <Select value={String(task.priority)} onValueChange={(value) => onPatch(task.id, { priority: Number(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((level) => (
                    <SelectItem key={level} value={String(level)}>{PRIORITY_LABELS[level]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Wanneer</Label>
            <Input
              id="task-due"
              type={task.allDay ? "date" : "datetime-local"}
              defaultValue={dueValue}
              onChange={(event) => {
                const value = event.target.value;
                onPatch(task.id, { dueAt: value ? new Date(value).toISOString() : null });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Lijst</Label>
            <Select
              value={task.listId ?? "none"}
              onValueChange={(value) => onPatch(task.id, { listId: value === "none" ? null : value })}
            >
              <SelectTrigger><SelectValue placeholder="Geen lijst" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen lijst</SelectItem>
                {lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={task.project?.id ?? "none"}
                onValueChange={(value) => onPatch(task.id, { projectId: value === "none" ? null : value })}
              >
                <SelectTrigger><SelectValue placeholder="Geen project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.number} · {project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Omschrijving</Label>
            <Textarea
              id="task-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => {
                if (description !== (task.description ?? "")) onPatch(task.id, { description: description || null });
              }}
              placeholder="Details, afspraken, wat er precies moet gebeuren…"
            />
          </div>

          {task.project && (
            <Link
              href={`/projects/${task.project.id}`}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <span className="truncate">{task.project.number} · {task.project.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          )}

          <div className="space-y-2">
            <Label>Aantekeningen</Label>
            {loadingComments ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    {comment.authorName} · {new Date(comment.createdAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {comment.visibility === "SHARED" && <Badge variant="outline" className="ml-1">Klant ziet dit</Badge>}
                  </p>
                </div>
              ))
            )}
            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Aantekening toevoegen…"
              />
              <Button size="sm" onClick={addComment} disabled={!commentBody.trim()}>Plaats</Button>
            </div>
          </div>

          <Button variant="outline" className="w-full text-red-600 hover:bg-red-50" onClick={() => onDelete(task.id)}>
            <Trash2 className="h-4 w-4" /> Verwijderen
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NewListDialog({
  open,
  scope,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  scope: Scope;
  onOpenChange: (open: boolean) => void;
  onCreated: (list: TaskList) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("LIST");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/task-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, name: name.trim(), kind }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Aanmaken mislukt");
      onCreated({ ...body, _count: { tasks: 0 } });
      setName("");
      setKind("LIST");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aanmaken mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nieuwe lijst</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="list-name">Naam</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={scope === "private" ? "Boodschappen" : "Marketing"}
              onKeyDown={(event) => event.key === "Enter" && submit()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Soort</Label>
            <Select value={kind} onValueChange={(value) => setKind(value ?? "LIST")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LIST">Lijst</SelectItem>
                <SelectItem value="SHOPPING">Boodschappen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
