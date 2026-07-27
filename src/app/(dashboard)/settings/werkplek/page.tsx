import Link from "next/link";
import { CalendarDays, Cpu, Link2, ListTodo } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiStatus } from "@/lib/ai/provider";
import { googleStatus } from "@/lib/calendar/google";
import { pushConfigured } from "@/lib/push";
import { PageHeader } from "@/components/layout/page-header";
import { PushToggle } from "@/components/push-toggle";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function WerkplekSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [ai, google, feed, counts] = await Promise.all([
    aiStatus(),
    googleStatus(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { calendarFeedToken: true } }),
    Promise.all([
      prisma.task.count({ where: { ownerId: userId, deletedAt: null, status: { in: ["OPEN", "DOING", "WAITING"] } } }),
      prisma.note.count({ where: { ownerId: userId, deletedAt: null } }),
      prisma.pushSubscription.count({ where: { userId } }),
    ]),
  ]);

  const [openTasks, notes, devices] = counts;

  const rows = [
    {
      icon: Cpu,
      title: "AI",
      value: ai.provider === "local-cli" ? "Lokale CLI op je laptop" : ai.provider === "openai" ? "OpenAI-API" : "Niet ingesteld",
      ok: ai.online,
      detail:
        ai.provider === "local-cli"
          ? ai.online
            ? "De relay is bereikbaar. Draait op je abonnement, dus geen kosten per token."
            : "De relay reageert niet. Controleer de service met npm run ai:relay:status."
          : ai.reason ?? "Kost per token via OpenAI.",
    },
    {
      icon: CalendarDays,
      title: "Google Calendar",
      value: google.connected ? "Gekoppeld" : google.configured ? "Nog niet gekoppeld" : "Niet ingesteld",
      ok: google.connected,
      detail: google.configured
        ? "Taken met een datum verschijnen automatisch in je agenda. Privé gaat naar een aparte agenda."
        : "GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET ontbreken in de omgeving.",
    },
    {
      icon: Link2,
      title: "Agendalink (ICS)",
      value: feed?.calendarFeedToken ? "Actief" : "Niet aangemaakt",
      ok: Boolean(feed?.calendarFeedToken),
      detail: "Werkt in elke agenda-app, maar ververst traag. Aanmaken doe je op de agendapagina.",
    },
    {
      icon: ListTodo,
      title: "Meldingen",
      value: !pushConfigured() ? "Niet ingesteld" : devices > 0 ? `${devices} apparaat${devices === 1 ? "" : "en"}` : "Uit",
      ok: devices > 0,
      detail: "Een seintje bij nieuwe klantfeedback of een getekend contract.",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Werkplek"
        title="Instellingen"
        description={`${openTasks} taken open, ${notes} notities.`}
      />

      <div className="grid gap-4 p-5 lg:grid-cols-2 lg:p-8">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.title} className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <row.icon className="h-4 w-4 text-slate-400" /> {row.title}
                </span>
                <Badge variant={row.ok ? "default" : "secondary"}>{row.value}</Badge>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-500">{row.detail}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <PushToggle />

          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
            <p className="text-sm font-bold text-slate-900">Review-widget op een klantsite</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-500">
              Zet dit op een site die je laat reviewen. Het widget doet niets tot iemand de
              reviewlink gebruikt, dus gewone bezoekers merken er niets van.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-5 text-slate-100">
{`<script defer
  src="${process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? ""}/review.js">
</script>`}
            </pre>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
            <p className="text-sm font-bold text-slate-900">Snel naar</p>
            <div className="mt-2 grid gap-1.5 text-sm">
              <Link href="/agenda" className="rounded-lg px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Agenda en koppelingen</Link>
              <Link href="/tasks" className="rounded-lg px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Taken</Link>
              <Link href="/contracts" className="rounded-lg px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Contracten</Link>
              <Link href="/admin/settings" className="rounded-lg px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Bedrijfsinstellingen</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
