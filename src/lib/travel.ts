import pc4Centroids from "@/data/pc4-centroids.json";

export type TravelPricingTier = {
  /** Bovengrens in km (enkele reis). null = geen bovengrens (laatste schijf). */
  maxKm: number | null;
  /** Voorrijkosten excl. btw voor deze schijf. */
  price: number;
};

const CENTROIDS = pc4Centroids as unknown as Record<string, [number, number]>;

/** Factor om hemelsbrede afstand om te rekenen naar een realistische rijafstand over de weg. */
const ROAD_DISTANCE_FACTOR = 1.3;

const EARTH_RADIUS_KM = 6371;

export function extractPc4(zipCode: string | null | undefined): string | null {
  if (!zipCode) return null;
  const match = zipCode.replace(/\s/g, "").match(/^(\d{4})/);
  return match ? match[1] : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Schat de enkele-reis-afstand (in km, over de weg) tussen twee Nederlandse postcodes,
 * op basis van PC4-centroids. Geen externe API, dus een benadering: geschikt om een
 * voorrijkosten-schijf te bepalen, niet voor exacte navigatie.
 */
export function estimateTravelDistanceKm(
  fromZipCode: string | null | undefined,
  toZipCode: string | null | undefined,
): number | null {
  const fromPc4 = extractPc4(fromZipCode);
  const toPc4 = extractPc4(toZipCode);
  if (!fromPc4 || !toPc4) return null;

  const from = CENTROIDS[fromPc4];
  const to = CENTROIDS[toPc4];
  if (!from || !to) return null;

  if (fromPc4 === toPc4) return 0;

  const straightLineKm = haversineKm(from[0], from[1], to[0], to[1]);
  return Math.round(straightLineKm * ROAD_DISTANCE_FACTOR * 10) / 10;
}

export const DEFAULT_TRAVEL_PRICING_TIERS: TravelPricingTier[] = [
  { maxKm: 20, price: 35 },
  { maxKm: null, price: 65 },
];

export function getTravelPrice(
  distanceKm: number,
  tiers: TravelPricingTier[] = DEFAULT_TRAVEL_PRICING_TIERS,
): number | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => (a.maxKm ?? Infinity) - (b.maxKm ?? Infinity));
  const tier = sorted.find((t) => t.maxKm === null || distanceKm <= t.maxKm);
  return tier ? tier.price : sorted[sorted.length - 1].price;
}
