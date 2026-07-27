/**
 * ICS-feed: taken met een datum als agenda-items, zodat Google/Apple Agenda
 * erop kan abonneren zonder OAuth. Read-only en Google ververst 'm traag (kan
 * uren duren) — voor echt live werken is de Google-koppeling er (google.ts).
 */

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  start: Date;
  end?: Date | null;
  allDay: boolean;
  url?: string | null;
  updatedAt: Date;
};

/** RFC 5545: regels max 75 octetten, vervolgregels beginnen met een spatie. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (currentBytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}

function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function stampUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function stampDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WebsUp//Werkplek//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escape(calendarName)}`),
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stampUtc(event.updatedAt)}`);

    if (event.allDay) {
      const end = new Date(event.start);
      end.setDate(end.getDate() + 1); // DTEND is exclusief bij hele dagen
      lines.push(`DTSTART;VALUE=DATE:${stampDate(event.start)}`);
      lines.push(`DTEND;VALUE=DATE:${stampDate(end)}`);
    } else {
      const end = event.end ?? new Date(event.start.getTime() + 30 * 60000);
      lines.push(`DTSTART:${stampUtc(event.start)}`);
      lines.push(`DTEND:${stampUtc(end)}`);
    }

    lines.push(fold(`SUMMARY:${escape(event.title)}`));
    if (event.description) lines.push(fold(`DESCRIPTION:${escape(event.description)}`));
    if (event.url) lines.push(fold(`URL:${escape(event.url)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
