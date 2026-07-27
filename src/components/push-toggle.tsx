"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Base64url → Uint8Array, zoals de Push API het verwacht. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushToggle() {
  const [state, setState] = useState<{ configured: boolean; devices: number; publicKey: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const hasPush = "serviceWorker" in navigator && "PushManager" in window;

    fetch("/api/push/subscribe")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        setSupported(hasPush);
        setState(body);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!state?.configured) return null;

  async function enable() {
    if (!supported) return toast.error("Deze browser ondersteunt geen meldingen");
    if (!state?.publicKey) return toast.error("Meldingen zijn nog niet ingesteld");

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Je hebt meldingen geweigerd. Zet ze aan in je browserinstellingen.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(state.publicKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error();

      setState((current) => (current ? { ...current, devices: current.devices + 1 } : current));
      toast.success("Meldingen staan aan — je krijgt zo een testmelding");
    } catch {
      toast.error("Aanzetten mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: "DELETE" });
        await subscription.unsubscribe();
      } else {
        await fetch("/api/push/subscribe", { method: "DELETE" });
      }
      setState((current) => (current ? { ...current, devices: 0 } : current));
      toast.success("Meldingen uit");
    } catch {
      toast.error("Uitzetten mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Bell className="h-4 w-4 text-slate-400" /> Meldingen op dit apparaat
      </div>
      <p className="mt-1 text-[13px] leading-6 text-slate-500">
        Een seintje zodra een klant feedback geeft of een contract tekent. Op de iPhone werkt
        dit pas als je de app op je beginscherm hebt gezet.
      </p>
      {state.devices > 0 ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={disable} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
          Uitzetten ({state.devices} apparaat{state.devices === 1 ? "" : "en"})
        </Button>
      ) : (
        <Button size="sm" className="mt-3" onClick={enable} disabled={busy || !supported}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Meldingen aanzetten
        </Button>
      )}
    </div>
  );
}
