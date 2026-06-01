"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";

type QuoteItem = {
  id: string;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  total: string | number;
};

type Quote = {
  id: string;
  number: string;
  status: string;
  intro: string | null;
  outro: string | null;
  validUntil: string | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  items: QuoteItem[];
  customer: { name: string; email: string | null; address: string | null; city: string | null };
  company: { name: string; slug: string };
  adviceDocuments: { id: string; type: string }[];
};

type Share = {
  id: string;
  token: string;
  acceptedAt: string | null;
  declinedAt: string | null;
};

const ADVICE_TYPE_LABELS: Record<string, string> = {
  BATTERY: "Thuisbatterij advies",
  EMS: "EMS advies",
  SOLAR: "Zonnepanelen advies",
  ELECTRICAL: "Elektrische installatie advies",
  CAMERA: "Camera advies",
  HEATPUMP: "Warmtepomp advies",
};

export function QuotePortalClient({
  quote,
  share,
  companySlug,
}: {
  quote: Quote;
  share: Share;
  companySlug: string;
  branding: Record<string, string>;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"accepted" | "declined" | null>(
    share.acceptedAt ? "accepted" : share.declinedAt ? "declined" : null
  );

  const isKoolhaas = companySlug === "koolhaas";

  async function handleAction(action: "accept" | "decline") {
    setSubmitting(true);
    try {
      await fetch(`/api/portal/${share.token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setSubmitted(action === "accept" ? "accepted" : "declined");
      toast.success(action === "accept" ? "Offerte geaccepteerd!" : "Offerte afgewezen");
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen py-12 px-4"
      data-company={companySlug}
      style={{
        backgroundColor: isKoolhaas ? "#F0FDF4" : "#F8FAFC",
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Company header */}
        <div className="text-center py-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: isKoolhaas ? "#0F2818" : "#0F172A" }}
          >
            {quote.company.name}
          </h1>
          {isKoolhaas && (
            <p className="text-sm text-muted-foreground mt-1">
              Persoonlijk · Technisch sterk · Friesland
            </p>
          )}
        </div>

        {/* Offerte header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">Offerte {quote.number}</h2>
                <p className="text-muted-foreground">{formatDate(new Date().toISOString())}</p>
                {quote.validUntil && (
                  <p className="text-sm text-muted-foreground">
                    Geldig tot: {formatDate(quote.validUntil)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">{quote.customer.name}</p>
                {quote.customer.email && (
                  <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
                )}
                {quote.customer.city && (
                  <p className="text-sm text-muted-foreground">{quote.customer.city}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Intro */}
        {quote.intro && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{quote.intro}</p>
            </CardContent>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-6 py-3 font-semibold">Omschrijving</th>
                    <th className="text-right px-4 py-3 font-semibold">Aantal</th>
                    <th className="text-right px-4 py-3 font-semibold">Prijs</th>
                    <th className="text-right px-6 py-3 font-semibold">Totaal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{Number(item.qty)}×</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotaal excl. BTW</span>
                <span>{formatCurrency(Number(quote.totalExVat))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>BTW</span>
                <span>{formatCurrency(Number(quote.totalVat))}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Totaal incl. BTW</span>
                <span>{formatCurrency(Number(quote.totalIncVat))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outro */}
        {quote.outro && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{quote.outro}</p>
            </CardContent>
          </Card>
        )}

        {/* Advice documents */}
        {quote.adviceDocuments.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <p className="font-semibold text-sm mb-3">Bijgevoegde adviesdocumenten</p>
              {quote.adviceDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{ADVICE_TYPE_LABELS[doc.type] ?? doc.type}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/api/advice/${doc.id}/pdf`, "_blank")}
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Downloaden
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        {submitted ? (
          <Card>
            <CardContent className="pt-6 text-center py-8">
              {submitted === "accepted" ? (
                <div className="space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                  <p className="font-semibold text-lg">Offerte geaccepteerd!</p>
                  <p className="text-muted-foreground text-sm">
                    Bedankt voor uw bevestiging. We nemen zo snel mogelijk contact met u op.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="font-semibold text-lg">Offerte afgewezen</p>
                  <p className="text-muted-foreground text-sm">
                    Uw reactie is ontvangen. Heeft u vragen? Neem contact met ons op.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="font-semibold">Uw reactie</p>
              <Textarea
                placeholder="Optionele opmerking of vraag..."
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleAction("accept")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Offerte accepteren
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleAction("decline")}
                  disabled={submitting}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Afwijzen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
