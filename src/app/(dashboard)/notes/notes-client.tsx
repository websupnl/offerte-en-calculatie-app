"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Loader2, Lock, Pin, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Scope } from "@/lib/tasks";

type Note = {
  id: string; title: string | null; body: string; pinned: boolean;
  updatedAt: string;
  project: { id: string; number: string; title: string } | null;
  customer: { id: string; name: string } | null;
};

export function NotesClient({
  initialNotes,
  projects,
  hasCompany,
}: {
  initialNotes: Note[];
  projects: { id: string; number: string; title: string }[];
  hasCompany: boolean;
}) {
  const [scope, setScope] = useState<Scope>(hasCompany ? "business" : "private");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Note | "new" | null>(null);
  const loadedOnce = useRef(true);

  const reload = useCallback(async (nextScope: Scope) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notes?scope=${nextScope}`);
      if (!response.ok) throw new Error();
      setNotes(await response.json());
    } catch {
      toast.error("Kon notities niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadedOnce.current) {
      loadedOnce.current = false;
      return;
    }
    reload(scope);
  }, [scope, reload]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(
      (note) => note.title?.toLowerCase().includes(query) || note.body.toLowerCase().includes(query),
    );
  }, [notes, search]);

  async function togglePin(note: Note) {
    const previous = notes;
    setNotes((current) =>
      current
        .map((item) => (item.id === note.id ? { ...item, pinned: !item.pinned } : item))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    );
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setNotes(previous);
      toast.error("Opslaan mislukt");
    }
  }

  async function remove(id: string) {
    const previous = notes;
    setNotes((current) => current.filter((note) => note.id !== id));
    setOpen(null);
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Notitie verwijderd");
    } catch {
      setNotes(previous);
      toast.error("Verwijderen mislukt");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Werkplek"
        title="Notities"
        description={
          scope === "private"
            ? "Je eigen aantekeningen. Hangen aan jou, niet aan een bedrijf."
            : "Aantekeningen bij klanten, projecten en losse ideeën."
        }
        actions={
          <>
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
            <Button onClick={() => setOpen("new")}><Plus className="h-4 w-4" /> Nieuwe notitie</Button>
          </>
        }
      />

      <div className="space-y-5 p-5 lg:p-8">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoeken in notities"
            className="pl-9"
            aria-label="Notities zoeken"
          />
        </div>

        {loading ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        ) : visible.length === 0 ? (
          <div className="grid min-h-56 place-items-center rounded-2xl bg-white text-center text-sm text-slate-400 ring-1 ring-slate-950/[0.06]">
            <div>
              <StickyNote className="mx-auto mb-2 h-8 w-8" />
              {search ? "Niets gevonden." : "Nog geen notities."}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((note) => (
              <div
                key={note.id}
                className="group relative flex flex-col rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06] transition hover:ring-slate-950/[0.12]"
              >
                <button
                  type="button"
                  onClick={() => togglePin(note)}
                  aria-label={note.pinned ? "Losmaken" : "Vastzetten"}
                  className={cn(
                    "absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg transition",
                    note.pinned ? "text-amber-500" : "text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100",
                  )}
                >
                  <Pin className={cn("h-4 w-4", note.pinned && "fill-current")} />
                </button>
                <button type="button" onClick={() => setOpen(note)} className="min-w-0 flex-1 text-left">
                  {note.title && <p className="truncate pr-8 font-bold text-slate-950">{note.title}</p>}
                  <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.body}</p>
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  <span>{new Date(note.updatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
                  {note.project && <span>· {note.project.number}</span>}
                  {note.customer && <span>· {note.customer.name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <NoteSheet
          key={open === "new" ? "new" : open.id}
          note={open === "new" ? null : open}
          scope={scope}
          projects={scope === "business" ? projects : []}
          onClose={() => setOpen(null)}
          onSaved={(note) =>
            setNotes((current) => {
              const rest = current.filter((item) => item.id !== note.id);
              return [note, ...rest].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
            })
          }
          onDelete={remove}
        />
      )}
    </div>
  );
}

function NoteSheet({
  note,
  scope,
  projects,
  onClose,
  onSaved,
  onDelete,
}: {
  note: Note | null;
  scope: Scope;
  projects: { id: string; number: string; title: string }[];
  onClose: () => void;
  onSaved: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [projectId, setProjectId] = useState(note?.project?.id ?? "none");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim()) {
      toast.error("Notitie mag niet leeg zijn");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || null,
        body: body.trim(),
        projectId: projectId === "none" ? null : projectId,
      };
      const response = await fetch(note ? `/api/notes/${note.id}` : "/api/notes", {
        method: note ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note ? payload : { ...payload, scope }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error ?? "Opslaan mislukt");
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left">{note ? "Notitie bewerken" : "Nieuwe notitie"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Titel</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optioneel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-body">Notitie</Label>
            <Textarea
              id="note-body"
              rows={14}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Schrijf op wat je niet wilt vergeten…"
              autoFocus={!note}
            />
          </div>

          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(value) => setProjectId(value ?? "none")}>
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

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !body.trim()} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
            {note && (
              <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(note.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
