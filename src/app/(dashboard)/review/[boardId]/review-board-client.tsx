"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, ImageIcon, Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "@/lib/tasks";

type Pin = {
  id: string; title: string; description: string | null; status: string;
  createdAt: string; source: string;
  pin: { selector?: string; xPct?: number; yPct?: number; pageX?: number; pageY?: number; viewport?: string; url?: string } | null;
  _count: { comments: number };
};

type Board = {
  id: string; name: string; kind: string; url: string | null; status: string;
  imageWidth: number | null; imageHeight: number | null;
  project: { id: string; number: string; title: string };
  pins: Pin[];
};

export function ReviewBoardClient({ board, imageUrl }: { board: Board; imageUrl: string | null }) {
  const [pins, setPins] = useState(board.pins);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const open = pins.filter((pin) => pin.status !== "DONE" && pin.status !== "CANCELLED");

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setPins((current) => current.map((pin) => (pin.id === id ? { ...pin, status } : pin)));
    } catch {
      toast.error("Bijwerken mislukt");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${board.project.number} · ${board.kind === "LIVE" ? "Live pagina" : "Schermafbeelding"}`}
        title={board.name}
        description={`${open.length} van ${pins.length} punt${pins.length === 1 ? "" : "en"} staat nog open.`}
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href={`/projects/${board.project.id}`} />}>
              <ArrowLeft className="h-4 w-4" /> Project
            </Button>
            {board.url && (
              <Button nativeButton={false} variant="outline" render={<a href={board.url} target="_blank" rel="noreferrer" />}>
                <ExternalLink className="h-4 w-4" /> Openen
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px] lg:p-8">
        {/* Weergave */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
          {board.kind === "IMAGE" && imageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={board.name} className="block w-full" />
              {pins.map((pin, index) => {
                if (!pin.pin?.xPct || !pin.pin?.yPct) return null;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => setActive(pin.id)}
                    style={{ left: `${pin.pin.xPct * 100}%`, top: `${pin.pin.yPct * 100}%` }}
                    className={cn(
                      "absolute -ml-3 -mt-3 grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md transition",
                      pin.status === "DONE" ? "bg-emerald-600" : "bg-rose-500",
                      active === pin.id && "scale-125 ring-2 ring-rose-300",
                    )}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          ) : board.kind === "LIVE" && board.url ? (
            <div className="relative">
              <iframe
                src={board.url}
                title={board.name}
                className="h-[70vh] w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
              <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <MonitorSmartphone className="mr-1 inline h-3 w-3" />
                Pinnen doe je op de site zelf met de reviewlink — niet hier. Een iframe van
                een andere site is afgeschermd, dus klikken erin kan ik niet vastleggen.
              </p>
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center text-center text-sm text-slate-400">
              <div><ImageIcon className="mx-auto mb-2 h-8 w-8" />Geen weergave beschikbaar.</div>
            </div>
          )}
        </div>

        {/* Punten */}
        <aside className="space-y-2">
          {pins.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-950/[0.06]">
              Nog geen feedback op dit board.
            </div>
          )}
          {pins.map((pin, index) => (
            <div
              key={pin.id}
              onMouseEnter={() => setActive(pin.id)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                "rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 transition",
                active === pin.id ? "ring-rose-300" : "ring-slate-950/[0.06]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white",
                  pin.status === "DONE" ? "bg-emerald-600" : "bg-rose-500",
                )}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold text-slate-900", pin.status === "DONE" && "text-slate-400 line-through")}>
                    {pin.title}
                  </p>
                  {pin.pin?.viewport && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {Number(pin.pin.viewport.split("x")[0]) < 768 ? "📱 mobiel" : "💻 desktop"} · {pin.pin.viewport}
                    </p>
                  )}
                  {pin.pin?.selector && (
                    <code className="mt-1 block truncate text-[11px] text-slate-400">{pin.pin.selector}</code>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge variant={pin.status === "DONE" ? "default" : "outline"}>
                  {TASK_STATUS_LABELS[pin.status]}
                </Badge>
                <div className="flex-1" />
                {pin.status !== "DONE" ? (
                  <Button size="sm" variant="outline" disabled={busy === pin.id} onClick={() => setStatus(pin.id, "DONE")}>
                    {busy === pin.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Klaar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy === pin.id} onClick={() => setStatus(pin.id, "OPEN")}>
                    Heropenen
                  </Button>
                )}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
