"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileText, FolderKanban, Package, Search, Users, Loader2, ArrowRight } from "lucide-react";

type SearchResult = {
  id: string;
  type: "quote" | "project" | "customer" | "product";
  title: string;
  subtitle: string;
  href: string;
};

const icons = {
  quote: FileText,
  project: FolderKanban,
  customer: Users,
  product: Package,
};

const quickLinks = [
  { title: "Nieuwe offerte", subtitle: "Start een nieuw voorstel", href: "/quotes/new", type: "quote" as const },
  { title: "Nieuwe klant", subtitle: "Open klantenbeheer", href: "/customers", type: "customer" as const },
  { title: "Artikelen & prijzen", subtitle: "Beheer catalogus en sets", href: "/admin/products", type: "product" as const },
];

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Zoeken mislukt");
        const body = await response.json();
        setResults(body.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  function navigate(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const visibleResults = query.trim().length < 2 ? quickLinks : results;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-[12vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Globaal zoeken</DialogTitle>
        </DialogHeader>
        <div className="relative border-b">
          {loading ? (
            <Loader2 className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) setResults([]);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && visibleResults[0]) navigate(visibleResults[0].href);
            }}
            placeholder="Zoek klant, project, offerte of artikel…"
            className="h-16 rounded-none border-0 bg-transparent pl-14 pr-16 text-base shadow-none focus-visible:ring-0"
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            {query.trim().length < 2 ? "Snel starten" : `${results.length} resultaten`}
          </p>
          {visibleResults.length === 0 && !loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Geen resultaten voor “{query}”.
            </div>
          ) : (
            visibleResults.map((result, index) => {
              const Icon = icons[result.type];
              return (
                <Link
                  key={"id" in result ? `${result.type}-${result.id}` : result.href}
                  href={result.href}
                  onClick={() => onOpenChange(false)}
                  className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{result.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                  </div>
                  {index === 0 ? (
                    <span className="hidden text-[10px] text-muted-foreground sm:block">Enter</span>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </Link>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span>Zoekt binnen het actieve bedrijf</span>
          <span>⌘/Ctrl + K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
