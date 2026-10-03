"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { filenameFromResponse } from "@/lib/download-filename";

export function InvoicePdfDownload({ invoiceId, toolbar = false }: { invoiceId: string; toolbar?: boolean }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`);
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "PDF downloaden mislukt");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromResponse(response, "factuur.pdf");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF downloaden mislukt");
    } finally {
      setDownloading(false);
    }
  }

  const icon = downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />;
  const label = downloading ? "PDF maken..." : "Download PDF";

  if (toolbar) {
    return <button type="button" onClick={download} disabled={downloading}>{icon} {label}</button>;
  }
  return <Button size="sm" variant="secondary" onClick={download} disabled={downloading}>{icon} {label}</Button>;
}
