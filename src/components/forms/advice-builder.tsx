"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Loader2, 
  Sparkles, 
  Wand2, 
  ArrowLeft, 
  Save, 
  ChevronDown, 
  FileText,
  Activity,
  Zap,
  TrendingUp,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

type Customer = { id: string; name: string; email: string | null };
type AdviceScenario = { name: string; capacityKwh: number; goal: string };
type AdviceData = {
  id?: string;
  customerId?: string;
  title: string;
  summary?: string;
  analysis?: string;
  recommendation?: string;
  consumption?: { annualKwh?: number; nightKwh?: number; solarWp?: number; exportedKwh?: number };
  scenarios?: AdviceScenario[];
  calculation?: { steps?: string[]; resultKwh?: number };
  ems?: { explanation?: string };
  backup?: { explanation?: string };
};

export function AdviceBuilder({
  customers,
  initialAdvice,
}: {
  customers: Customer[];
  initialAdvice?: AdviceData;
}) {
  const router = useRouter();
  
  // State
  const [customerId, setCustomerId] = useState(initialAdvice?.customerId || "");
  const [intakePrompt, setIntakePrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Advice Data State
  const [adviceData, setAdviceData] = useState<AdviceData | null>(initialAdvice || null);

  const customer = customers.find((c) => c.id === customerId);
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  async function handleGenerateAdvice() {
    if (!customerId) return toast.error("Selecteer eerst een klant");
    if (!intakePrompt.trim()) return toast.error("Plak eerst de intake-gegevens of aantekeningen");
    
    setGenerating(true);
    const toastId = toast.loading("AI analyseert de gegevens en berekent het advies...");

    try {
      const res = await fetch("/api/ai/extract-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: intakePrompt, customerId }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setAdviceData(data);
      toast.success("Adviesrapport gegenereerd!", { id: toastId });
    } catch {
      toast.error("AI generatie mislukt. Probeer het opnieuw.", { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  async function handleConvertToQuote() {
    if (!adviceData) return;
    toast.info("Offerte wordt voorbereid op basis van het 'Comfort' scenario...");
    // Redirect to new quote page with prefilled data
    // We'll implement this logic in the QuoteBuilder later
    router.push(`/quotes/new?adviceId=${adviceData.id}`);
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-muted/40 pb-20">
      {/* ─── Header ─── */}
      <header className="sticky top-[72px] z-20 bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-none">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Terug
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="font-bold text-foreground text-lg">
            {initialAdvice ? "Adviesrapport aanpassen" : "Nieuw Energie-advies opstellen"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <PopoverTrigger render={
              <Button variant="outline" className="w-[240px] justify-between font-medium">
                <span className="truncate">{customer?.name || "Selecteer klant"}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            } />
            <PopoverContent align="end" className="w-[300px] p-0">
              <div className="p-2 border-b border-border">
                <Input
                  autoFocus
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Zoek klant..."
                  className="h-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Geen klant gevonden</p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerPickerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted ${
                        c.id === customerId ? "bg-primary/10 text-primary font-bold" : ""
                      }`}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button disabled={!adviceData} className="bg-primary hover:bg-primary">
            <Save className="mr-2 h-4 w-4" /> Rapport Opslaan
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ─── Left Column: Intake & Controls ─── */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-primary/25 shadow-none">
            <CardHeader className="bg-primary/10">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Intake Gegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-muted-foreground uppercase">Input / Gesprek / P1 Data</Label>
                <Textarea 
                  placeholder="Plak hier het gesprek met de klant, de P1 verbruiksgegevens of je eigen opname-notities..." 
                  className="min-h-[300px] resize-none focus:ring-primary/25"
                  value={intakePrompt}
                  onChange={(e) => setIntakePrompt(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerateAdvice} 
                disabled={generating || !customerId} 
                className="w-full h-12 bg-primary hover:bg-primary font-bold text-lg gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                Genereer Technisch Advies
              </Button>
            </CardContent>
          </Card>

          {adviceData && (
            <Card className="bg-foreground text-background border-none shadow-xl overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <CheckCircle2 className="h-24 w-24" />
              </div>
              <CardContent className="p-6 relative z-10 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-black text-xl text-primary">Advies Gereed</h3>
                  <p className="text-muted-foreground text-sm">Zet dit advies nu om naar een officiële offerte.</p>
                </div>
                <Button 
                  onClick={handleConvertToQuote}
                  className="w-full bg-card text-foreground hover:bg-primary/10 font-black h-12"
                >
                  <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                  Genereer Offerte
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right Column: The Report Preview ─── */}
        <div className="lg:col-span-7">
          {!adviceData ? (
            <div className="h-full min-h-[600px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground p-12 text-center bg-card/50">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-muted-foreground mb-2">Nog geen advies gegenereerd</h2>
              <p className="max-w-xs text-sm">
                Plak links de intake-gegevens en klik op &quot;Genereer&quot; om de AI het technisch rapport te laten opstellen.
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Report Header */}
              <div className="bg-card border rounded-xl shadow-xl p-8 space-y-6">
                <div className="flex justify-between items-start border-b pb-6">
                  <div className="space-y-1">
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-primary">Energie-advies rapport</span>
                    <h2 className="text-3xl font-black text-foreground">{adviceData.title}</h2>
                    <p className="text-muted-foreground font-medium">{customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-muted-foreground uppercase">Gecontroleerd op</p>
                    <p className="font-bold">{new Date().toLocaleDateString('nl-NL')}</p>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="space-y-3">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Advies in het kort
                  </h3>
                  <div className="bg-primary/10 border border-primary/25 rounded-xl p-4 text-primary font-medium leading-relaxed whitespace-pre-wrap">
                    {adviceData.summary}
                  </div>
                </div>

                {/* Situation Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/40 rounded-xl p-4 border border-border">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Jaarverbruik</p>
                    <p className="font-black text-lg text-foreground">{adviceData.consumption?.annualKwh} kWh</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4 border border-border">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Nachtverbruik (gem)</p>
                    <p className="font-black text-lg text-foreground">{adviceData.consumption?.nightKwh} kWh</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4 border border-border">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Zonnepanelen (Wp)</p>
                    <p className="font-black text-lg text-foreground">{adviceData.consumption?.solarWp} Wp</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4 border border-border">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Teruglevering</p>
                    <p className="font-black text-lg text-foreground">{adviceData.consumption?.exportedKwh} kWh</p>
                  </div>
                </div>

                <Separator />

                {/* Scenarios Table */}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" /> Geadviseerde scenario&apos;s
                  </h3>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-muted/40 text-muted-foreground text-sm font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 border-b">Scenario</th>
                          <th className="px-4 py-3 border-b">Capaciteit</th>
                          <th className="px-4 py-3 border-b">Focus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {adviceData.scenarios?.map((scenario, i) => (
                          <tr key={i} className={i === 1 ? "bg-primary/10" : ""}>
                            <td className="px-4 py-3 font-bold">{scenario.name} {i === 1 && "✨"}</td>
                            <td className="px-4 py-3 font-medium">{scenario.capacityKwh} kWh</td>
                            <td className="px-4 py-3 text-muted-foreground">{scenario.goal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Analysis Block */}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Technische Onderbouwing
                  </h3>
                  <div className="prose prose-slate prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {adviceData.analysis}
                  </div>
                </div>

                {/* Calculation Steps */}
                <div className="bg-foreground text-background rounded-xl p-6 space-y-4">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Dimensionering berekening</p>
                  <div className="space-y-2">
                    {adviceData.calculation?.steps?.map((step: string, i: number) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-primary font-bold">{i + 1}.</span>
                        <span className="text-slate-200">{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="font-bold text-primary">Resultaat:</span>
                    <span className="text-2xl font-black">{adviceData.calculation?.resultKwh} kWh bruikbaar</span>
                  </div>
                </div>

                {/* EMS & Backup */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl space-y-2">
                    <p className="font-bold text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Slimme Sturing (EMS)
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{adviceData.ems?.explanation}</p>
                  </div>
                  <div className="p-4 border rounded-xl space-y-2">
                    <p className="font-bold text-sm flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-green-500" /> Noodstroom (Back-up)
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{adviceData.backup?.explanation}</p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="pt-6 border-t">
                  <h3 className="font-bold text-foreground mb-2">Waarom dit advies?</h3>
                  <p className="text-sm text-muted-foreground italic">
                    {adviceData.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
