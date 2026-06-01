import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  companyName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 9,
    color: "#666",
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  label: {
    color: "#666",
    marginBottom: 1,
  },
  section: {
    marginBottom: 20,
  },
  intro: {
    marginBottom: 20,
    lineHeight: 1.5,
    color: "#333",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    padding: "8 12",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#555",
  },
  tableRow: {
    flexDirection: "row",
    padding: "7 12",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsSection: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalLabel: { color: "#666" },
  totalGrand: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#1a1a1a",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  outro: {
    marginTop: 20,
    lineHeight: 1.5,
    color: "#333",
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
  accent: { color: "#6366F1" },
  accentGreen: { color: "#16A34A" },
});

type QuoteItem = {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
};

type QuotePDFProps = {
  companyName: string;
  companySlug: string;
  companyTagline?: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil?: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  intro?: string;
  outro?: string;
  items: QuoteItem[];
  totalExVat: number;
  totalVat: number;
  totalIncVat: number;
};

function formatEur(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

export function QuotePDF({
  companyName,
  companySlug,
  companyTagline,
  quoteNumber,
  quoteDate,
  validUntil,
  customerName,
  customerEmail,
  customerAddress,
  customerCity,
  intro,
  outro,
  items,
  totalExVat,
  totalVat,
  totalIncVat,
}: QuotePDFProps) {
  const accentStyle = companySlug === "koolhaas" ? styles.accentGreen : styles.accent;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.companyName, accentStyle]}>{companyName}</Text>
            {companyTagline && <Text style={styles.companyTagline}>{companyTagline}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.quoteTitle}>Offerte {quoteNumber}</Text>
            <Text style={styles.label}>{quoteDate}</Text>
            {validUntil && <Text style={styles.label}>Geldig tot: {validUntil}</Text>}
          </View>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Gericht aan</Text>
          <Text>{customerName}</Text>
          {customerEmail && <Text style={styles.label}>{customerEmail}</Text>}
          {customerAddress && <Text style={styles.label}>{customerAddress}</Text>}
          {customerCity && <Text style={styles.label}>{customerCity}</Text>}
        </View>

        {/* Intro */}
        {intro && <Text style={styles.intro}>{intro}</Text>}

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Omschrijving</Text>
          <Text style={styles.colQty}>Aantal</Text>
          <Text style={styles.colPrice}>Prijs</Text>
          <Text style={styles.colTotal}>Totaal</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.qty}×</Text>
            <Text style={styles.colPrice}>{formatEur(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatEur(item.total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotaal excl. BTW</Text>
            <Text>{formatEur(totalExVat)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>BTW</Text>
            <Text>{formatEur(totalVat)}</Text>
          </View>
          <View style={styles.totalGrand}>
            <Text>Totaal incl. BTW</Text>
            <Text>{formatEur(totalIncVat)}</Text>
          </View>
        </View>

        {/* Outro */}
        {outro && <Text style={styles.outro}>{outro}</Text>}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{companyName}</Text>
          <Text>Offerte {quoteNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
