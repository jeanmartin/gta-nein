/** Tile types, flags, zones and compass helpers. Pure module. */

export const T = {
  GRASS: 0,
  ROAD: 1,
  SIDEWALK: 2,
  BIKE: 3,
  BUILDING: 4,
  LOT: 5, // parking-lot aisle (drivable, not a legal place to leave the car)
  PARKING: 6, // marked parking bay
  DRIVEWAY: 7, // lowered curb: cars and pedestrians allowed
  PATH: 8, // park path / plaza (pedestrians only)
  WATER: 9,
} as const;
export type TileType = (typeof T)[keyof typeof T];

export const F = {
  CROSSWALK: 1,
  ZEBRA: 2,
  TUNNEL: 4,
  LAWN: 8, // "Rasen betreten verboten"
  RURAL: 16,
  SOLID: 32, // solid object on the tile (container, ...)
} as const;

export const Z = {
  NONE: 0,
  Z50: 1,
  Z30: 2,
  SPIEL: 3,
  AUTOBAHN: 4,
  LAND: 5,
  LOT: 6,
} as const;
export type ZoneId = (typeof Z)[keyof typeof Z];

export const ZONE_LIMIT: readonly number[] = [Infinity, 50, 30, 7, Infinity, 100, 10];
export const ZONE_NAME: readonly string[] = [
  '',
  'Innerorts',
  'Tempo-30-Zone',
  'Spielstraße · Schrittgeschwindigkeit',
  'Autobahn · Richtgeschwindigkeit 130',
  'Landstraße',
  'Parkplatz · StVO gilt auch hier',
];
export const AUTOBAHN_MIN_KMH = 60;

export type Card = 'E' | 'S' | 'W' | 'N';
export type Axis = 'h' | 'v';
export const CARDS: readonly Card[] = ['E', 'S', 'W', 'N'];
export const VEC: Record<Card, readonly [number, number]> = {
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
  N: [0, -1],
};
export const BIT: Record<Card, number> = { E: 1, S: 2, W: 4, N: 8 };
export const ANGLE: Record<Card, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };

const RIGHT: Record<Card, Card> = { E: 'S', S: 'W', W: 'N', N: 'E' };
const LEFT: Record<Card, Card> = { E: 'N', N: 'W', W: 'S', S: 'E' };
const OPP: Record<Card, Card> = { E: 'W', W: 'E', N: 'S', S: 'N' };
export const rightOf = (c: Card): Card => RIGHT[c];
export const leftOf = (c: Card): Card => LEFT[c];
export const opposite = (c: Card): Card => OPP[c];
export const axisOf = (c: Card): Axis => (c === 'E' || c === 'W' ? 'h' : 'v');

export function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Nearest compass direction of a vector, or null if it is more than `tolDeg` off-axis. */
export function cardFromVec(x: number, y: number, tolDeg = 45): Card | null {
  if (Math.hypot(x, y) < 1e-6) return null;
  const ang = Math.atan2(y, x);
  const idx = Math.round(ang / (Math.PI / 2));
  const c = CARDS[((idx % 4) + 4) % 4];
  const diff = Math.abs(normAngle(ang - (idx * Math.PI) / 2));
  return diff <= (tolDeg * Math.PI) / 180 + 1e-9 ? c : null;
}

export type Turn = 'straight' | 'left' | 'right' | 'uturn';
export function relTurn(from: Card, to: Card): Turn {
  if (from === to) return 'straight';
  if (rightOf(from) === to) return 'right';
  if (leftOf(from) === to) return 'left';
  return 'uturn';
}

export function cardsInMask(mask: number): Card[] {
  return CARDS.filter((c) => (mask & BIT[c]) !== 0);
}

/** Tiny deterministic hash for decorative variety. Returns [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
