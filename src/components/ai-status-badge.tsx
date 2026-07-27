"use client";

import { useEffect, useState } from "react";
import { Cpu, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = { provider: "local-cli" | "openai" | "none"; online: boolean; reason?: string };

/**
 * Laat zien of AI nu kan. Bij de lokale CLI hangt dat aan of Daans laptop
 * aan staat — dan is "AI offline" een feit, geen storing, en dat moet je
 * kunnen zien vóór je op een knop drukt die anders blijft hangen.
 */
export function AiStatusBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/ai/status")
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => {
          if (!cancelled) setStatus(body);
        })
        .catch(() => {});

    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!status || status.provider === "none") return null;

  const local = status.provider === "local-cli";
  const label = !status.online ? "AI offline" : local ? "AI lokaal" : "AI via OpenAI";

  return (
    <span
      title={status.reason ?? (local ? "Draait op de CLI op je laptop" : "Draait via de OpenAI-API")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
        className,
      )}
    >
      {status.online ? <Cpu className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
      {label}
    </span>
  );
}
