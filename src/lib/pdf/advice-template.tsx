import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const ADVICE_TYPE_LABELS: Record<string, string> = {
  BATTERY: "Thuisbatterij Advies",
  EMS: "EMS & Energiemanagement Advies",
  SOLAR: "Zonnepanelen Advies",
  ELECTRICAL: "Verdeelkast & Elektra Advies",
  CAMERA: "Camera & Beveiliging Advies",
  HEATPUMP: "Warmtepomp Advies",
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: "#16A34A",
    paddingBottom: 16,
  },
  companyName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  companyTagline: {
    fontSize: 9,
    color: "#666",
  },
  docTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
    color: "#0F2818",
  },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 8,
    color: "#888",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  contentSection: {
    marginTop: 24,
  },
  paragraph: {
    marginBottom: 8,
    lineHeight: 1.6,
    color: "#333",
  },
  h1: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 8,
    color: "#0F2818",
  },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    color: "#1a4a28",
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
    color: "#333",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 12,
    color: "#16A34A",
  },
  listText: {
    flex: 1,
    color: "#333",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#999",
  },
  accentBar: {
    height: 4,
    backgroundColor: "#16A34A",
    marginBottom: 0,
  },
});

type ContentBlock =
  | { type: "h1" | "h2" | "h3" | "paragraph"; text: string }
  | { type: "listItem"; text: string };

function parseMarkdown(content: string): ContentBlock[] {
  const lines = content.split("\n");
  const blocks: ContentBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ type: "listItem", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      blocks.push({ type: "h3", text: trimmed.replace(/\*\*/g, "") });
    } else {
      // Strip inline markdown
      const cleaned = trimmed
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1");
      blocks.push({ type: "paragraph", text: cleaned });
    }
  }

  return blocks;
}

type Props = {
  companyName: string;
  companySlug: string;
  companyTagline: string;
  customerName: string;
  adviceType: string;
  content: string;
  createdAt: string;
};

export function AdvicePDF({
  companyName,
  companyTagline,
  customerName,
  adviceType,
  content,
  createdAt,
}: Props) {
  const blocks = parseMarkdown(content);
  const docTitle = ADVICE_TYPE_LABELS[adviceType] ?? "Adviesdocument";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.companyTagline}>{companyTagline}</Text>
          <Text style={styles.docTitle}>{docTitle}</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Voor</Text>
              <Text style={styles.metaValue}>{customerName}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>Datum</Text>
              <Text style={styles.metaValue}>{createdAt}</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          {blocks.map((block, i) => {
            if (block.type === "h1") {
              return <Text key={i} style={styles.h1}>{block.text}</Text>;
            }
            if (block.type === "h2") {
              return <Text key={i} style={styles.h2}>{block.text}</Text>;
            }
            if (block.type === "h3") {
              return <Text key={i} style={styles.h3}>{block.text}</Text>;
            }
            if (block.type === "listItem") {
              return (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listText}>{block.text}</Text>
                </View>
              );
            }
            return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{companyName} — {docTitle}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} van ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
