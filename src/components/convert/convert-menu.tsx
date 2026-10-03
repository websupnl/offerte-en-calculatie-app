"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ClipboardList, FolderKanban, Loader2, ReceiptText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "Doorzetten naar": project, werkbon of factuur vanuit een offerte of calculatie. */
export function ConvertMenu({ type, id, className }: { type: "quote" | "calculation"; id: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function convert(make: "project" | "workorder") {
    setBusy(true);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: { type, id }, make }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Doorzetten mislukt");
      if (make === "project") {
        toast.success(data.created ? "Project aangemaakt" : "Project bestond al, gekoppeld");
        router.push(`/projects/${data.projectId}`);
      } else {
        toast.success(`Werkbon ${data.number} aangemaakt`);
        router.push(`/workorders/${data.workOrderId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        className={
          className ??
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50"
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Doorzetten <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => convert("project")}>
          <FolderKanban className="h-4 w-4" /> Project aanmaken
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => convert("workorder")}>
          <ClipboardList className="h-4 w-4" /> Werkbon maken
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/invoices/new?source=${type}:${id}`)}>
          <ReceiptText className="h-4 w-4" /> Factuur maken
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
