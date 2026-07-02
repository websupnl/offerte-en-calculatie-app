// Bouwt een nette, veilige PDF-bestandsnaam uit losse delen,
// bv. pdfFilename("Offerte", "WU-2025-014", "Jan Jansen") → "Offerte-WU-2025-014-Jan-Jansen.pdf"
export function pdfFilename(...parts: Array<string | null | undefined>): string {
  const slug = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) =>
      p
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("-");
  return `${slug || "document"}.pdf`;
}
