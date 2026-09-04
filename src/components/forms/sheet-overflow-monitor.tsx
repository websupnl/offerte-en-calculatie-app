"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Een offertepagina is een echte A4 met `overflow: hidden`. Past de tekst niet,
 * dan valt het overschot er stil af: de klant ziet een halve zin en jij merkt
 * er niets van. Dat gebeurt vooral bij door AI gegenereerde teksten.
 *
 * Deze monitor meet elke pagina en waarschuwt zodra de inhoud niet meer past.
 */

type Overvol = { paginaNummer: number; titel: string; teveelPx: number };

function metenSheets(root: HTMLElement): Overvol[] {
  const sheets = [...root.querySelectorAll<HTMLElement>("section.sheet")];
  const resultaat: Overvol[] = [];

  sheets.forEach((sheet, index) => {
    const pad = sheet.querySelector<HTMLElement>(".pad");
    if (!pad) return;

    // De pad is height:100% maar zijn kinderen krimpen niet (flex-shrink: 0),
    // dus bij te veel inhoud is de scrollhoogte groter dan de pagina.
    const beschikbaar = sheet.clientHeight;
    const nodig = pad.scrollHeight;
    const teveel = Math.round(nodig - beschikbaar);

    if (teveel > 4) {
      const kop = sheet.querySelector(".h2, .cov-h1")?.textContent?.trim();
      resultaat.push({
        paginaNummer: index + 1,
        titel: kop && kop.length > 0 ? kop : `Pagina ${index + 1}`,
        teveelPx: teveel,
      });
    }
  });

  return resultaat;
}

export function SheetOverflowMonitor({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [overvol, setOvervol] = useState<Overvol[]>([]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Meten na de layout, en opnieuw bij elke wijziging in de preview.
    let frame = 0;
    const meet = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOvervol(metenSheets(root)));
    };

    meet();
    const observer = new MutationObserver(meet);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    const resize = new ResizeObserver(meet);
    resize.observe(root);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
    };
  }, [containerRef]);

  if (overvol.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 text-sm">
          <p className="font-bold text-amber-900">
            {overvol.length === 1 ? "Eén pagina loopt over" : `${overvol.length} pagina's lopen over`}
          </p>
          <p className="mt-0.5 text-amber-800">
            De tekst hieronder valt buiten het papier en is voor de klant niet zichtbaar. Kort in of verplaats naar een eigen pagina.
          </p>
          <ul className="mt-1.5 space-y-0.5 text-amber-900">
            {overvol.map((o) => (
              <li key={o.paginaNummer}>
                Pagina {o.paginaNummer}, {o.titel}
                <span className="text-amber-700"> — ongeveer {Math.ceil(o.teveelPx / 24)} regels te veel</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
