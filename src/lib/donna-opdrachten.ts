/**
 * Een geaccepteerde offerte aanmelden als opdracht bij Donna.
 *
 * Donna maakt er zelf een project en een taak van en stuurt Daan een bericht.
 * Deze app hoeft dus alleen te melden dát er een opdracht is.
 *
 * Twee dingen bepalen het ontwerp:
 *
 * 1. Het akkoord van de klant is heilig. Als Donna plat ligt of traag is, mag
 *    dat het akkoord in deze app niet tegenhouden en niet terugdraaien. Daarom
 *    wordt dit ná de statuswijziging aangeroepen, in `after()`, en vangt het
 *    alle fouten zelf af.
 * 2. Opnieuw sturen moet veilig zijn. Donna ontdubbelt op `reference`, dus een
 *    tweede poging maakt geen tweede project. Daarom durven we te herhalen bij
 *    een netwerkfout.
 */

const BASIS_URL = "https://emma.onlinewerkplek.cloud/api/opdrachten";
const TIMEOUT_MS = 10_000;
const POGINGEN = 3;

/** Donna kent twee bronnen. De slugs van deze app wijken iets af. */
const BEDRIJF_PER_SLUG: Record<string, "koolhaas" | "websup"> = {
  koolhaas: "koolhaas",
  "koolhaas-installaties": "koolhaas",
  websup: "websup",
  "websup-nl": "websup",
};

export function donnaBedrijf(companySlug: string | null | undefined): "koolhaas" | "websup" | null {
  return BEDRIJF_PER_SLUG[companySlug?.trim().toLowerCase() ?? ""] ?? null;
}

/** Bedragen gaan als hele centen naar Donna, nooit als kommagetal. */
export function naarCenten(bedrag: unknown): number | undefined {
  if (bedrag === null || bedrag === undefined) return undefined;
  const getal = typeof bedrag === "number" ? bedrag : Number(bedrag);
  if (!Number.isFinite(getal) || getal < 0) return undefined;
  return Math.round(getal * 100);
}

export type OpdrachtPayload = {
  reference: string;
  title: string;
  customerName: string;
  customerRef?: string;
  quoteNumber?: string;
  amountCents?: number;
  currency?: string;
  description?: string;
  url?: string;
  acceptedAt?: string;
};

/** Wat deze app van een offerte weet; los gehouden van Prisma zodat het te testen is. */
export type OpdrachtBron = {
  quoteId: string;
  quoteNumber: string | null;
  title: string | null;
  customerName: string;
  customerId: string | null;
  totalIncVat: unknown;
  acceptedAt: Date | string | null;
  /** Regels die de klant op de offerte ziet, voor de omschrijving. */
  regels?: { description: string }[];
  appUrl?: string | null;
};

const kort = (tekst: string, max: number) =>
  tekst.length <= max ? tekst : `${tekst.slice(0, max - 1).trimEnd()}…`;

export function bouwOpdrachtPayload(bron: OpdrachtBron): OpdrachtPayload {
  // reference is de ontdubbelsleutel bij Donna. Het offerte-id verandert nooit,
  // een offertenummer in theorie wel, dus we nemen het id.
  const payload: OpdrachtPayload = {
    reference: bron.quoteId,
    title: kort(bron.title?.trim() || bron.quoteNumber || "Opdracht", 200),
    customerName: bron.customerName,
  };

  if (bron.customerId) payload.customerRef = bron.customerId;
  if (bron.quoteNumber) payload.quoteNumber = bron.quoteNumber;

  const centen = naarCenten(bron.totalIncVat);
  if (centen !== undefined) {
    payload.amountCents = centen;
    payload.currency = "EUR";
  }

  const omschrijving = (bron.regels ?? [])
    .map((regel) => regel.description?.trim())
    .filter((d): d is string => Boolean(d))
    .join("\n");
  if (omschrijving) payload.description = kort(omschrijving, 2000);

  // Donna weigert een url die niet met https begint. Lokaal is dat http, dus
  // dan sturen we het veld liever niet mee dan een 400 op te halen.
  const url = bron.appUrl ? `${bron.appUrl.replace(/\/+$/, "")}/quotes/${bron.quoteId}` : null;
  if (url?.startsWith("https://")) payload.url = url;

  const geaccepteerd = bron.acceptedAt
    ? new Date(bron.acceptedAt)
    : null;
  if (geaccepteerd && !Number.isNaN(geaccepteerd.getTime())) {
    payload.acceptedAt = geaccepteerd.toISOString();
  }

  return payload;
}

export type MeldResultaat =
  | { status: "verstuurd"; duplicaat: boolean; antwoord: unknown }
  | { status: "overgeslagen"; reden: string }
  | { status: "mislukt"; reden: string };

/**
 * Meldt de opdracht bij Donna. Gooit nooit: de aanroeper heeft al een akkoord
 * van een klant afgehandeld en mag daar niet alsnog op stuklopen.
 */
export async function meldOpdrachtBijDonna(
  bedrijf: "koolhaas" | "websup" | null,
  payload: OpdrachtPayload,
  opties: { fetchImpl?: typeof fetch; secret?: string | null } = {},
): Promise<MeldResultaat> {
  const secret = opties.secret ?? process.env.DONNA_OPDRACHTEN_SECRET;
  if (!secret) {
    // Geen geheim betekent: koppeling staat niet aan. Dat is geen storing.
    console.warn("[Donna] DONNA_OPDRACHTEN_SECRET ontbreekt, opdracht niet gemeld");
    return { status: "overgeslagen", reden: "geen secret" };
  }
  if (!bedrijf) {
    console.warn("[Donna] Onbekend bedrijf, opdracht niet gemeld");
    return { status: "overgeslagen", reden: "onbekend bedrijf" };
  }

  const doeFetch = opties.fetchImpl ?? fetch;
  let laatsteFout = "onbekend";

  for (let poging = 1; poging <= POGINGEN; poging++) {
    try {
      const response = await doeFetch(`${BASIS_URL}/${bedrijf}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-donna-opdrachten-secret": secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const antwoord = await response.json().catch(() => null);

      if (response.ok) {
        const duplicaat = Boolean((antwoord as { duplicate?: boolean } | null)?.duplicate);
        console.info(
          `[Donna] Opdracht ${payload.reference} ${duplicaat ? "was al gemeld" : "aangemeld"}`,
        );
        return { status: "verstuurd", duplicaat, antwoord };
      }

      const fout = (antwoord as { error?: string } | null)?.error ?? `http ${response.status}`;
      // 4xx is onze eigen fout: opnieuw proberen levert exact dezelfde afwijzing.
      if (response.status < 500) {
        console.error(`[Donna] Opdracht ${payload.reference} geweigerd: ${fout}`);
        return { status: "mislukt", reden: fout };
      }
      laatsteFout = fout;
    } catch (err) {
      laatsteFout = err instanceof Error ? err.message : String(err);
    }

    if (poging < POGINGEN) {
      await new Promise((klaar) => setTimeout(klaar, 500 * 2 ** (poging - 1)));
    }
  }

  console.error(`[Donna] Opdracht ${payload.reference} niet gemeld na ${POGINGEN} pogingen: ${laatsteFout}`);
  return { status: "mislukt", reden: laatsteFout };
}
