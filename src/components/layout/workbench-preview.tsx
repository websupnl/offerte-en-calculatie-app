"use client";

import { useState } from "react";
import { Calculator, Check, FileText, Plus, GripVertical, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalculationForkAction } from "@/components/calculations/calculation-fork-action";

export function WorkbenchPreview() {
  const [busy, setBusy] = useState(false);
  const showExample = () => toast.info("Dit is een ontwerpvoorbeeld. Er worden geen gegevens opgeslagen.");
  return <WorkspaceShell userName="Daan">
    <PageHeader eyebrow="Ontwerpvoorbeeld · geen klantgegevens" title="Een werkplek die samenhangt" description="Calculatie, concept en uitvoering krijgen dezelfde rustige basis." actions={<Button onClick={showExample}><Plus />Nieuwe calculatie</Button>} />
    <div className="space-y-6 p-5 lg:p-8">
      <Tabs defaultValue="calculatie">
        <TabsList aria-label="Voorbeeldschermen">
          <TabsTrigger value="calculatie"><Calculator />Calculatie</TabsTrigger>
          <TabsTrigger value="offerte"><FileText />Offerte</TabsTrigger>
        </TabsList>
        <TabsContent value="calculatie" className="mt-4 space-y-5">
          <section className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4" aria-label="Voorbeeldbedragen">
            {[["Materiaalinkoop", "€ 920,00", "Excl. btw"], ["Verkoopprijs", "€ 1.490,00", "€ 1.802,90 incl. btw"], ["Wat je overhoudt", "€ 570,00", "Waarvan € 360,00 uuromzet"], ["Marge", "38,3%", "Verkoop min materiaal / omzet"]].map(([label, value, detail]) => <div key={label} className="border-b border-border p-5 sm:border-r xl:border-b-0 last:border-r-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>)}
          </section>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm text-muted-foreground">Prijsbron van</p><p className="font-semibold">Conceptofferte <Badge variant="outline" className="ml-2">Zonder nummer</Badge></p></div>
            <Button variant="outline" onClick={showExample}><Check />Concept actualiseren</Button>
          </div>
          <Card>
            <CardHeader><CardTitle>Gegevens en koppeling</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="example-title">Naam calculatie</Label><Input id="example-title" defaultValue="Laadpunt met meterkastuitbreiding" /></div><div className="space-y-2"><Label htmlFor="example-customer">Klant</Label><Input id="example-customer" value="Voorbeeldklant" readOnly /></div></CardContent>
          </Card>
          <Card className="gap-0 pb-0!">
            <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3 pb-4"><CardTitle>Calculatieregels</CardTitle><Button size="sm" variant="outline" onClick={showExample}><Plus />Regel toevoegen</Button></CardHeader>
            <CardContent className="px-0!">
              <Table><TableHeader><TableRow><TableHead className="w-10"><span className="sr-only">Volgorde</span></TableHead><TableHead>Omschrijving</TableHead><TableHead>Aantal</TableHead><TableHead className="text-right">Inkoop</TableHead><TableHead className="text-right">Verkoop</TableHead></TableRow></TableHeader>
                <TableBody>{[["Laadpunt", "1 stuk", "€ 680,00", "€ 850,00"], ["Meterkast en bekabeling", "1 set", "€ 240,00", "€ 280,00"], ["Installatie en ingebruikname", "6 uur", "€ 0,00", "€ 360,00"]].map(([title,qty,cost,price]) => <TableRow key={title}><TableCell><GripVertical className="size-4 text-muted-foreground" /></TableCell><TableCell className="font-medium">{title}</TableCell><TableCell className="text-muted-foreground">{qty}</TableCell><TableCell className="text-right tabular-nums">{cost}</TableCell><TableCell className="text-right tabular-nums">{price}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
          <CalculationForkAction title="Laadpunt met meterkastuitbreiding" canCreateAlternative locked={false} busy={busy} onCopy={showExample} onAlternative={() => { setBusy(true); window.setTimeout(() => { setBusy(false); showExample(); }, 900); }} />
        </TabsContent>
        <TabsContent value="offerte" className="mt-4">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <article className="min-w-0 rounded-lg border border-border bg-white p-6 text-[#17202c] sm:p-12">
              <div className="flex items-center justify-between border-b border-[#e2e5e8] pb-6"><strong className="text-lg">Koolhaas Installaties</strong><span className="text-sm text-[#56616d]">Concept</span></div>
              <p className="mt-10 text-sm text-[#56616d]">Voorbeeldklant</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Een laadpunt dat past bij jouw situatie</h2><p className="mt-5 text-base leading-7 text-[#56616d]">Deze pagina laat de documentruimte zien. Je bewerkt tekst op het papier en beheert prijzen, afbeeldingen en bijlagen in het paneel ernaast.</p>
              <div className="mt-12 border-y border-[#e2e5e8] py-6"><p className="text-sm text-[#56616d]">Totale investering, incl. btw</p><p className="mt-2 text-3xl font-semibold tabular-nums">€ 1.802,90</p></div><p className="mt-12 text-sm text-[#56616d]">Ontwerpvoorbeeld met fictieve inhoud</p>
            </article>
            <Card><CardHeader className="border-b pb-4"><CardTitle>Offerte bewerken</CardTitle></CardHeader><CardContent>
              <Tabs defaultValue="prijs"><TabsList className="grid h-auto! w-full! grid-cols-2"><TabsTrigger value="prijs">Prijs</TabsTrigger><TabsTrigger value="pagina">Pagina’s</TabsTrigger><TabsTrigger value="media">Media</TabsTrigger><TabsTrigger value="documenten">Documenten</TabsTrigger></TabsList>
                <TabsContent value="prijs" className="mt-4 space-y-4"><div><h3 className="text-base font-semibold">Calculaties</h3><p className="mt-1 text-base leading-6 text-muted-foreground">Wijzig de prijs bij de bron en werk je concept daarna bij.</p></div><Button variant="outline" onClick={showExample} className="w-full"><Calculator />Open calculatie<ArrowUpRight /></Button></TabsContent>
                <TabsContent value="pagina" className="mt-4"><p className="text-base text-muted-foreground">Kies welke onderdelen in de offerte staan.</p></TabsContent>
                <TabsContent value="media" className="mt-4"><Button variant="outline" onClick={showExample}><Plus />Afbeelding kiezen</Button></TabsContent>
                <TabsContent value="documenten" className="mt-4"><Button variant="outline" onClick={showExample}><Plus />Document toevoegen</Button></TabsContent>
              </Tabs>
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </WorkspaceShell>;
}
