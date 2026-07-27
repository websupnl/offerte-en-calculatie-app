/**
 * Google Calendar-koppeling. Bewust met kale fetch in plaats van de googleapis-
 * library: we gebruiken drie endpoints, dat is een dependency van 50MB niet waard.
 *
 * Richting: app → Google (push). Een taak met een datum wordt een event; afvinken
 * of verwijderen haalt 'm weg. Privétaken gaan naar een aparte agenda, zodat je
 * werk en privé in Google gescheiden kunt kleuren en delen.
 *
 * Nodig in de env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 */

import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar"];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/integrations/google/callback`;
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // nodig om echt een refresh_token terug te krijgen
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google gaf ${response.status}: ${await response.text()}`);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

/** Geldig access token, ververst zichzelf als het bijna verlopen is. */
async function accessTokenFor(userId: string): Promise<{ token: string; integrationId: string } | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
  });
  if (!integration) return null;

  const stillValid = integration.expiresAt && integration.expiresAt.getTime() - Date.now() > 60_000;
  if (stillValid) return { token: integration.accessToken, integrationId: integration.id };

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: integration.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    // Toegang ingetrokken aan Google-kant: koppeling opruimen i.p.v. blijven proberen.
    if (response.status === 400 || response.status === 401) {
      await prisma.userIntegration.delete({ where: { id: integration.id } }).catch(() => {});
    }
    return null;
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    },
  });
  return { token: body.access_token, integrationId: integration.id };
}

async function api(userId: string, path: string, init: RequestInit = {}) {
  const auth = await accessTokenFor(userId);
  if (!auth) {
    throw new Error("Google Calendar-koppeling is verlopen of ingetrokken");
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
    },
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Google Calendar gaf ${response.status}: ${await response.text()}`);
  return response.status === 204 ? {} : await response.json();
}

/** Zorgt dat er een aparte "Privé"-agenda is, en onthoudt welke dat is. */
async function privateCalendarId(userId: string): Promise<string | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
    select: { id: true, privateCalendarId: true },
  });
  if (!integration) return null;
  if (integration.privateCalendarId) return integration.privateCalendarId;

  const created = await api(userId, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: "Werkplek — Privé", timeZone: "Europe/Amsterdam" }),
  });
  if (!created?.id) return null;

  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { privateCalendarId: created.id },
  });
  return created.id as string;
}

type SyncTask = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date | null;
  dueAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
  companyId: string | null;
  calendarEventId: string | null;
  ownerId: string;
};

export type CalendarSyncResult =
  | { status: "synced" }
  | { status: "skipped" }
  | { status: "failed"; message: string };

function eventBody(task: SyncTask) {
  const start = task.startAt ?? task.dueAt!;
  const metadata = {
    extendedProperties: {
      private: {
        websupTaskId: task.id,
      },
    },
  };

  if (task.allDay) {
    const day = (d: Date) => {
      const copy = new Date(d);
      return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
    };
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      ...metadata,
      summary: task.title,
      description: task.description ?? undefined,
      start: { date: day(start) },
      end: { date: day(end) },
    };
  }
  const end = task.endAt ?? new Date(start.getTime() + 30 * 60000);
  return {
    ...metadata,
    summary: task.title,
    description: task.description ?? undefined,
    start: { dateTime: start.toISOString(), timeZone: "Europe/Amsterdam" },
    end: { dateTime: end.toISOString(), timeZone: "Europe/Amsterdam" },
  };
}

/**
 * Zet één taak in Google. De aanroeper wacht dit resultaat af, maar de
 * taakmutatie blijft leidend: een Google-fout wordt apart aan de UI gemeld.
 */
export async function syncTaskToGoogle(task: SyncTask): Promise<CalendarSyncResult> {
  if (!googleConfigured()) return { status: "skipped" };

  try {
    const hasDate = Boolean(task.startAt ?? task.dueAt);

    // Nooit een privé-agenda aanmaken voor een taak zonder datum.
    if (!hasDate && !task.calendarEventId) return { status: "skipped" };

    const calendarId = task.companyId ? "primary" : await privateCalendarId(task.ownerId);
    if (!calendarId) {
      return {
        status: "failed",
        message: "Google Agenda is niet meer bereikbaar. Koppel je agenda opnieuw.",
      };
    }

    // Geen datum meer → event weghalen.
    if (!hasDate) {
      if (task.calendarEventId) {
        await api(task.ownerId, `/calendars/${encodeURIComponent(calendarId)}/events/${task.calendarEventId}`, {
          method: "DELETE",
        });
        await prisma.task.update({
          where: { id: task.id },
          data: { calendarEventId: null, calendarSyncedAt: null },
        });
      }
      return { status: "synced" };
    }

    const body = eventBody(task);

    if (task.calendarEventId) {
      const updated = await api(
        task.ownerId,
        `/calendars/${encodeURIComponent(calendarId)}/events/${task.calendarEventId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      // Event handmatig weggegooid in Google → opnieuw aanmaken.
      if (updated === null) {
        await prisma.task.update({ where: { id: task.id }, data: { calendarEventId: null } });
        return syncTaskToGoogle({ ...task, calendarEventId: null });
      }
      await prisma.task.update({ where: { id: task.id }, data: { calendarSyncedAt: new Date() } });
      return { status: "synced" };
    }

    const created = await api(task.ownerId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (created?.id) {
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId: created.id, calendarSyncedAt: new Date() },
      });
      return { status: "synced" };
    }
    return {
      status: "failed",
      message: "Google Agenda accepteerde de afspraak niet. De taak is wel opgeslagen.",
    };
  } catch (error) {
    console.error("[google-calendar] sync mislukt:", error);
    return {
      status: "failed",
      message: "Google Agenda kon niet worden bijgewerkt. De taak is wel opgeslagen.",
    };
  }
}

export async function removeTaskFromGoogle(task: {
  id: string;
  ownerId: string;
  companyId: string | null;
  calendarEventId: string | null;
}): Promise<CalendarSyncResult> {
  if (!task.calendarEventId) return { status: "skipped" };
  if (!googleConfigured()) {
    return {
      status: "failed",
      message: "De taak is verwijderd, maar Google Agenda kon niet worden bijgewerkt.",
    };
  }
  try {
    const calendarId = task.companyId ? "primary" : await privateCalendarId(task.ownerId);
    if (!calendarId) {
      return {
        status: "failed",
        message: "De taak is verwijderd, maar Google Agenda is niet meer gekoppeld.",
      };
    }
    await api(task.ownerId, `/calendars/${encodeURIComponent(calendarId)}/events/${task.calendarEventId}`, {
      method: "DELETE",
    });
    return { status: "synced" };
  } catch (error) {
    console.error("[google-calendar] verwijderen mislukt:", error);
    return {
      status: "failed",
      message: "De taak is verwijderd, maar de afspraak kon niet uit Google Agenda worden verwijderd.",
    };
  }
}

export async function googleStatus(userId: string) {
  if (!googleConfigured()) return { configured: false, connected: false };
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
    select: { createdAt: true, lastSyncAt: true },
  });
  return { configured: true, connected: Boolean(integration), since: integration?.createdAt ?? null };
}
