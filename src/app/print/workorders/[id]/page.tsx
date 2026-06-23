import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload, isStorageConfigured } from "@/lib/storage";
import { PrintOnLoad } from "@/components/print-on-load";
import { formatCurrency, formatDate, WORKORDER_STATUS_LABELS } from "@/lib/format";

export default async function WorkOrderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      company: true,
      project: { select: { number: true, title: true, customer: true, address: true, city: true } },
    },
  });
  if (!workOrder) notFound();

  const signatureUrl =
    workOrder.signatureKey && isStorageConfigured()
      ? await presignDownload(workOrder.signatureKey, 3600)
      : null;

  const total = workOrder.lines.reduce(
    (sum, l) => sum + Number(l.qty) * Number(l.unitPrice),
    0,
  );
  const customer = workOrder.project.customer;

  return (
    <main className="wo-print">
      <PrintOnLoad enabled={auto === "1"} />
      <style>{`
        .wo-print { font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 800px; margin: 0 auto; padding: 40px; font-size: 13px; }
        .wo-print h1 { font-size: 22px; margin: 0; }
        .wo-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
        .wo-meta { text-align: right; font-size: 12px; color: #374151; }
        .wo-grid { display: flex; gap: 40px; margin-bottom: 24px; }
        .wo-grid h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 0 0 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 6px 4px; }
        td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; }
        .num { text-align: right; white-space: nowrap; }
        .wo-total { display: flex; justify-content: flex-end; }
        .wo-total div { width: 240px; display: flex; justify-content: space-between; font-weight: bold; border-top: 2px solid #111827; padding-top: 8px; }
        .wo-sign { margin-top: 48px; display: flex; gap: 40px; }
        .wo-sign-box { flex: 1; }
        .wo-sign-box img { max-height: 90px; }
        .wo-sign-line { border-top: 1px solid #9ca3af; margin-top: 60px; padding-top: 4px; font-size: 11px; color: #6b7280; }
        @media print { .wo-print { padding: 20px; } }
      `}</style>

      <div className="wo-head">
        <div>
          <h1>Werkbon</h1>
          <p style={{ margin: "4px 0 0", color: "#374151" }}>{workOrder.company.name}</p>
        </div>
        <div className="wo-meta">
          <div><strong>{workOrder.number}</strong></div>
          <div>{WORKORDER_STATUS_LABELS[workOrder.status] ?? workOrder.status}</div>
          {workOrder.executedAt && <div>Uitgevoerd: {formatDate(workOrder.executedAt)}</div>}
          {!workOrder.executedAt && workOrder.scheduledAt && (
            <div>Gepland: {formatDate(workOrder.scheduledAt)}</div>
          )}
        </div>
      </div>

      <div className="wo-grid">
        <div>
          <h3>Klant</h3>
          <div>{customer?.name ?? "—"}</div>
          {workOrder.project.address && <div>{workOrder.project.address}</div>}
          {workOrder.project.city && <div>{workOrder.project.city}</div>}
        </div>
        <div>
          <h3>Project</h3>
          <div>{workOrder.project.number}</div>
          <div>{workOrder.project.title}</div>
        </div>
        <div>
          <h3>Monteur</h3>
          <div>{workOrder.technicianName ?? "—"}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>{workOrder.title}</h3>
      {workOrder.description && (
        <p style={{ marginTop: 0, color: "#374151", whiteSpace: "pre-wrap" }}>
          {workOrder.description}
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Omschrijving</th>
            <th className="num">Aantal</th>
            <th className="num">Eenheid</th>
            <th className="num">Prijs</th>
            <th className="num">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {workOrder.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.type === "ARBEID" ? "Arbeid" : "Materiaal"}</td>
              <td>{l.description}</td>
              <td className="num">{Number(l.qty)}</td>
              <td className="num">{l.unit ?? ""}</td>
              <td className="num">{formatCurrency(Number(l.unitPrice))}</td>
              <td className="num">{formatCurrency(Number(l.qty) * Number(l.unitPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wo-total">
        <div>
          <span>Totaal (excl. btw)</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="wo-sign">
        <div className="wo-sign-box">
          <h3 style={{ fontSize: 11, textTransform: "uppercase", color: "#6b7280" }}>
            Handtekening klant
          </h3>
          {signatureUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureUrl} alt="Handtekening" />
              <div className="wo-sign-line">
                {workOrder.signedBy ?? ""}
                {workOrder.signedAt ? ` — ${formatDate(workOrder.signedAt)}` : ""}
              </div>
            </>
          ) : (
            <div className="wo-sign-line">Naam + handtekening</div>
          )}
        </div>
        <div className="wo-sign-box">
          <h3 style={{ fontSize: 11, textTransform: "uppercase", color: "#6b7280" }}>
            Monteur
          </h3>
          <div className="wo-sign-line">{workOrder.technicianName ?? "Naam + handtekening"}</div>
        </div>
      </div>
    </main>
  );
}
