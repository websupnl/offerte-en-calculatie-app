import { notFound } from "next/navigation";
import { BrandPalettePreview } from "./preview";

export default function BrandingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BrandPalettePreview />;
}
