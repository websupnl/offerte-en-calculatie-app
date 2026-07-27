import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — Werkplek" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
      <div className="max-w-sm text-center">
        <WifiOff className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-950">Even geen verbinding</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          De app heeft internet nodig om je taken en projecten op te halen.
          Zodra je weer verbinding hebt, werkt alles weer.
        </p>
      </div>
    </main>
  );
}
