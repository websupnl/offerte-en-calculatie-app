"use client";

import { useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/confirm-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  Printer,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import {
  WORKORDER_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from "@/lib/format";

type Line = {
  id?: string;
  type: "MATERIAAL" | "ARBEID";
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

type WorkOrder = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  technicianName: string | null;
  scheduledAt: string | null;
  signedBy: string | null;
  signedAt: string | null;
  signatureKey: string | null;
  lines: {
    id: string;
    type: string;
    description: string;
    qty: string | number;
    unit: string | null;
    unitPrice: string | number;
  }[];
  project: {
    id: string;
    number: string;
    title: string;
    customer: { name: string } | null;
  };
};

const STATUSES = ["CONCEPT", "GEPLAND", "UITGEVOERD", "GEFACTUREERD"];

export function WorkOrderDetailClient({
  workOrder,
  signatureUrl: initialSignatureUrl,
}: {
  workOrder: WorkOrder;
  signatureUrl: string | null;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState(workOrder.title);
  const [description, setDescription] = useState(workOrder.description ?? "");
  const [technicianName, setTechnicianName] = useState(workOrder.technicianName ?? "");
  const [status, setStatus] = useState(workOrder.status);
  const [lines, setLines] = useState<Line[]>(
    workOrder.lines.map((l) => ({
      id: l.id,
      type: (l.type as "MATERIAAL" | "ARBEID") ?? "MATERIAAL",
      description: l.description,
      qty: Number(l.qty),
      unit: l.unit ?? "stuk",
      unitPrice: Number(l.unitPrice),
    })),
  );
  const [saving, setSaving] = useState(false);

  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl);
  const [signedBy, setSignedBy] = useState(workOrder.signedBy ?? "");
  const [sigData, setSigData] = useState<string | null>(null);
  const [savingSig, setSavingSig] = useState(false);

  const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  function addLine(type: "MATERIAAL" | "ARBEID") {
    setLines((prev) => [
      ...prev,
      {
        type,
        description: "",
        qty: 1,
        unit: type === "ARBEID" ? "uur" : "stuk",
        unitPrice: 0,
      },
    ]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/workorders/${workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          technicianName,
          status,
          lines: lines.map((l) => ({
            type: l.type,
            description: l.description,
            qty: l.qty,
            unit: l.unit,
            unitPrice: l.unitPrice,
          })),
        }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      toast.success("Werkbon opgeslagen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  async function saveSignature() {
    if (!sigData) {
      toast.error("Zet eerst een handtekening");
      return;
    }
    if (!signedBy.trim()) {
      toast.error("Vul de naam van de ondertekenaar in");
      return;
    }
    setSavingSig(true);
    try {
      const res = await fetch(`/api/workorders/${workOrder.id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: sigData, signedBy }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Opslaan mislukt");
      }
      const data = await res.json();
      setSignatureUrl(data.signatureUrl);
      setStatus((s) => (s === "GEFACTUREERD" ? s : "UITGEVOERD"));
      toast.success("Ondertekend");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSavingSig(false);
    }
  }

  async function clearSignature() {
    if (!(await confirm({ title: "Handtekening verwijderen?", body: "De klant moet dan opnieuw tekenen.", confirmLabel: "Verwijderen", destructive: true }))) return;
    const res = await fetch(`/api/workorders/${workOrder.id}/signature`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSignatureUrl(null);
      setSignedBy("");
      setSigData(null);
      toast.success("Handtekening verwijderd");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link
        href={`/projects/${workOrder.project.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {workOrder.project.number} · {workOrder.project.title}
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{workOrder.number}</span>
          <h1 className="text-xl font-bold">{title || "Werkbon"}</h1>
          <p className="text-sm text-muted-foreground">
            {workOrder.project.customer?.name ?? ""}
          </p>
        </div>
        <Badge variant="secondary">{WORKORDER_STATUS_LABELS[status] ?? status}</Badge>
      </div>

      {/* Kerngegevens */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Omschrijving</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monteur</Label>
              <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{WORKORDER_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regels */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Regels</h2>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addLine("MATERIAAL")}>
                <Plus className="h-4 w-4 mr-1" /> Materiaal
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLine("ARBEID")}>
                <Plus className="h-4 w-4 mr-1" /> Arbeid
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nog geen regels. Voeg materiaal of arbeid toe.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={l.type === "ARBEID" ? "default" : "secondary"}>
                      {l.type === "ARBEID" ? "Arbeid" : "Materiaal"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Omschrijving"
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Aantal</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.qty}
                        onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Eenheid</Label>
                      <Input
                        value={l.unit}
                        onChange={(e) => updateLine(i, { unit: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Prijs/st</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    {formatCurrency(l.qty * l.unitPrice)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t pt-3 font-semibold">
            <span>Totaal (excl. btw)</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Acties */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Opslaan
        </Button>
        <a href={`/print/workorders/${workOrder.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-1" /> PDF / print
          </Button>
        </a>
      </div>

      {/* Handtekening */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <PenLine className="h-4 w-4" /> Handtekening klant
          </h2>
          {signatureUrl ? (
            <div className="space-y-2">
              <div className="rounded-md border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureUrl} alt="Handtekening" className="max-h-40" />
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Ondertekend door {workOrder.signedBy ?? signedBy}
                {workOrder.signedAt ? ` op ${formatDate(workOrder.signedAt)}` : ""}
              </p>
              <Button variant="ghost" size="sm" onClick={clearSignature}>
                <Trash2 className="h-4 w-4 mr-1" /> Opnieuw tekenen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <SignaturePad onChange={setSigData} />
              <div className="space-y-2">
                <Label>Naam ondertekenaar</Label>
                <Input
                  value={signedBy}
                  onChange={(e) => setSignedBy(e.target.value)}
                  placeholder="Naam klant"
                />
              </div>
              <Button onClick={saveSignature} disabled={savingSig}>
                {savingSig ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <PenLine className="h-4 w-4 mr-1" />
                )}
                Ondertekenen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
