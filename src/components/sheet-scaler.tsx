"use client";

import { useEffect, useRef, useState } from "react";

// Breedte van een .sheet (210mm) in CSS-pixels.
const SHEET_WIDTH_PX = 794;

/**
 * Schaalt de A4-offertepreview automatisch mee met de beschikbare kolombreedte,
 * zodat de editor ook op laptopschermen naast het instellingenpaneel past.
 * Gebruikt CSS `zoom` zodat de layout (hoogte, klikbare inputs) meeschaalt.
 */
export function SheetScaler({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      setScale(Math.min(1, width / SHEET_WIDTH_PX));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div style={scale < 1 ? { zoom: scale } : undefined}>{children}</div>
    </div>
  );
}
