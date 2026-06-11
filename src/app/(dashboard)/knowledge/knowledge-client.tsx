"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Database, FileText, Euro, ExternalLink } from "lucide-react";
import Link from "next/link";

type Datasheet = {
  id: string;
  brand: string;
  model: string;
  category: string | null;
  specs: Record<string, unknown>;
  notes: string | null;
  price: number | null;
  sourceUrl: string | null;
  updatedAt: string;
};

type Finding = {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  createdAt: string;
  quote: { id: string; number: string; title: string | null } | null;
};

export function KnowledgeClient({
  initialDatasheets,
  initialFindings,
}: {
  initialDatasheets: Datasheet[];
  initialFindings: Finding[];
}) {
  const [dsQuery, setDsQuery] = useState("");
  const [fQuery, setFQuery] = useState("");

  const filteredDatasheets = initialDatasheets.filter((d) => {
    const q = dsQuery.toLowerCase();
    return (
      !q ||
      d.brand.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      (d.category ?? "").toLowerCase().includes(q) ||
      (d.notes ?? "").toLowerCase().includes(q)
    );
  });

  const filteredFindings = initialFindings.filter((f) => {
    const q = fQuery.toLowerCase();
    return (
      !q ||
      f.topic.toLowerCase().includes(q) ||
      f.content.toLowerCase().includes(q) ||
      f.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kennisbank</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Automatisch gevuld door Claude — datasheets en bevindingen uit onderzoek.
        </p>
      </div>

      <Tabs defaultValue="datasheets">
        <TabsList>
          <TabsTrigger value="datasheets" className="gap-2">
            <Database className="h-4 w-4" />
            Datasheets ({initialDatasheets.length})
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-2">
            <FileText className="h-4 w-4" />
            Bevindingen ({initialFindings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datasheets" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op merk, model, categorie..."
              className="pl-9"
              value={dsQuery}
              onChange={(e) => setDsQuery(e.target.value)}
            />
          </div>

          {filteredDatasheets.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Geen datasheets gevonden. Claude slaat automatisch datasheets op tijdens offerte-onderzoek.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredDatasheets.map((d) => (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {d.brand} {d.model}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {d.category && (
                            <Badge variant="secondary" className="text-xs">
                              {d.category}
                            </Badge>
                          )}
                          {d.price && (
                            <span className="text-sm text-muted-foreground flex items-center gap-0.5">
                              <Euro className="h-3 w-3" />
                              {Number(d.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.sourceUrl && (
                          <a
                            href={d.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(d.updatedAt).toLocaleDateString("nl-NL")}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.keys(d.specs).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(d.specs).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-xs font-normal">
                            {k}: {String(v)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {d.notes && (
                      <p className="text-sm text-muted-foreground">{d.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="findings" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek in bevindingen..."
              className="pl-9"
              value={fQuery}
              onChange={(e) => setFQuery(e.target.value)}
            />
          </div>

          {filteredFindings.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Geen bevindingen gevonden. Claude slaat automatisch conclusies op tijdens onderzoek.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredFindings.map((f) => (
                <Card key={f.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-base">{f.topic}</CardTitle>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(f.createdAt).toLocaleDateString("nl-NL")}
                      </span>
                    </div>
                    {f.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">{f.content}</p>
                    {f.quote && (
                      <Link
                        href={`/quotes/${f.quote.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        {f.quote.number} — {f.quote.title}
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
