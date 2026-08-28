"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

type Line = {
  description: string;
  qty: number;
  unitPrice: number;
  costPrice: number | null;
  vatRate: number;
  indent: number;
};

type Choice = {
  id: string;
  title: string;
  label?: string;
  items: Line[];
};

type ChoiceGroup = {
  id: string;
  title: string;
  choices: Choice[];
};

type QuoteForExport = {
  id: string;
  number: string;
  title: string | null;
  customer: { name: string };
  items: Line[];
  choiceGroups: ChoiceGroup[] | null;
};

function lineTotals(line: Line) {
  const verkoopExcl = Number(line.qty) * Number(line.unitPrice);
  const btw = verkoopExcl * (Number(line.vatRate) / 100);
  const verkoopIncl = verkoopExcl + btw;
  const inkoop = Number(line.qty) * Number(line.costPrice ?? 0);
  const marge = verkoopExcl - inkoop;
  const margePercent = inkoop > 0 ? (marge / inkoop) * 100 : verkoopExcl > 0 ? 100 : 0;
  const isIncluded = Number(line.indent) > 0 || (Number(line.unitPrice) === 0 && inkoop === 0);
  return { verkoopExcl, btw, verkoopIncl, inkoop, marge, margePercent, isIncluded };
}

function sectionTotals(lines: Line[]) {
  return lines.reduce(
    (acc, line) => {
      const t = lineTotals(line);
      acc.verkoopExcl += t.verkoopExcl;
      acc.verkoopIncl += t.verkoopIncl;
      acc.inkoop += t.inkoop;
      acc.marge += t.marge;
      return acc;
    },
    { verkoopExcl: 0, verkoopIncl: 0, inkoop: 0, marge: 0 },
  );
}

function LineRow({ line, intern }: { line: Line; intern: boolean }) {
  const t = lineTotals(line);
  if (t.isIncluded) {
    return (
      <tr className={line.indent > 0 ? "text-muted-foreground" : ""}>
        <td className="py-1.5 pl-3">{line.description}</td>
        <td className="py-1.5 text-right">{line.qty}</td>
        {intern && <td className="py-1.5 text-right">-</td>}
        <td className="py-1.5 text-right">inbegrepen</td>
        {intern && <td className="py-1.5 text-right">-</td>}
        <td className="py-1.5 text-right">inbegrepen</td>
      </tr>
    );
  }
  return (
    <tr>
      <td className="py-1.5 pl-3">{line.description}</td>
      <td className="py-1.5 text-right">{line.qty}</td>
      {intern && <td className="py-1.5 text-right">{formatCurrency(t.inkoop)}</td>}
      <td className="py-1.5 text-right">{formatCurrency(t.verkoopExcl)}</td>
      {intern && (
        <td className="py-1.5 text-right">
          {formatCurrency(t.marge)} <span className="text-xs text-muted-foreground">({t.margePercent.toFixed(0)}%)</span>
        </td>
      )}
      <td className="py-1.5 text-right font-medium">{formatCurrency(t.verkoopIncl)}</td>
    </tr>
  );
}

function SectionTable({ title, lines, intern }: { title: string; lines: Line[]; intern: boolean }) {
  const totals = sectionTotals(lines);
  return (
    <div className="mb-6 break-inside-avoid">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground">
            <th className="pb-1.5 pl-3 text-left font-medium">Omschrijving</th>
            <th className="pb-1.5 text-right font-medium">Aantal</th>
            {intern && <th className="pb-1.5 text-right font-medium">Inkoop</th>}
            <th className="pb-1.5 text-right font-medium">Verkoop excl.</th>
            {intern && <th className="pb-1.5 text-right font-medium">Marge</th>}
            <th className="pb-1.5 text-right font-medium">Verkoop incl.</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((line, i) => (
            <LineRow key={i} line={line} intern={intern} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-2 pl-3">Totaal</td>
            <td></td>
            {intern && <td className="py-2 text-right">{formatCurrency(totals.inkoop)}</td>}
            <td className="py-2 text-right">{formatCurrency(totals.verkoopExcl)}</td>
            {intern && (
              <td className="py-2 text-right">
                {formatCurrency(totals.marge)}{" "}
                <span className="text-xs text-muted-foreground">
                  ({totals.inkoop > 0 ? ((totals.marge / totals.inkoop) * 100).toFixed(0) : 0}%)
                </span>
              </td>
            )}
            <td className="py-2 text-right">{formatCurrency(totals.verkoopIncl)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CalculatieExportClient({ quote }: { quote: QuoteForExport }) {
  const [intern, setIntern] = useState(true);
  const choiceGroups = useMemo(() => quote.choiceGroups ?? [], [quote.choiceGroups]);

  const grandTotal = useMemo(() => {
    const allLines = [...quote.items, ...choiceGroups.flatMap((g) => g.choices.flatMap((c) => c.items))];
    return sectionTotals(allLines);
  }, [quote.items, choiceGroups]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Link href={`/quotes/${quote.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Calculatie {quote.number}</h1>
            <p className="text-sm text-muted-foreground">{quote.title} · {quote.customer.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setIntern(true)}
              className={`rounded-md px-3 py-1.5 ${intern ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Intern (incl. inkoop &amp; marge)
            </button>
            <button
              type="button"
              onClick={() => setIntern(false)}
              className={`rounded-md px-3 py-1.5 ${!intern ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Extern (alleen verkoop)
            </button>
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / opslaan als PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 print:border-0 print:p-0">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {intern ? "Interne calculatie, niet voor de klant" : "Prijsoverzicht"}
          </p>
          <h2 className="text-lg font-bold">{quote.title} — {quote.number}</h2>
          <p className="text-sm text-muted-foreground">{quote.customer.name}</p>
        </div>

        {/* Root-items zijn soms alleen een informatief materiaaloverzicht (prijs 0) dat al
            in de keuzevakken hieronder is geprijsd. Toon deze sectie alleen als er echt
            een vaste, geprijsde basis bovenop de configuraties zit. */}
        {sectionTotals(quote.items).verkoopExcl > 0 && (
          <SectionTable title="Vaste basis" lines={quote.items} intern={intern} />
        )}

        {choiceGroups.map((group) => (
          <div key={group.id} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            {group.choices.map((choice) => (
              <SectionTable
                key={choice.id}
                title={`${choice.title}${choice.label ? ` (${choice.label})` : ""}`}
                lines={choice.items}
                intern={intern}
              />
            ))}
          </div>
        ))}

        {choiceGroups.length === 0 && (
          <div className="mt-4 border-t pt-3 text-right text-sm">
            <span className="text-muted-foreground">Totaal incl. btw </span>
            <span className="text-base font-bold">{formatCurrency(grandTotal.verkoopIncl)}</span>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}
