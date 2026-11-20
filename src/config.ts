/** Global game constants. Pure module: safe to import from tests. */

/** One tile is 32 px and represents roughly 4 m. */
export const TILE = 32;

/** Game-scale speed conversion (not physically exact; tuned for feel). */
export const KMH_PER_PXS = 0.25;
export const PXS_PER_KMH = 1 / KMH_PER_PXS;
export const toKmh = (pxs: number): number => pxs * KMH_PER_PXS;
export const toPxs = (kmh: number): number => kmh * PXS_PER_KMH;

export const GAME_W = 1280;
export const GAME_H = 720;

export const START_MONEY = 1500;
export const MAX_POINTS = 8;

/** Size of a lazily rendered map chunk in px. */
export const CHUNK_PX = 1024;

/** Brake fluid "consumed" per second of full braking, in litres. */
export const BRAKE_FLUID_PER_SEC = 0.012;

export const CITY_NAME = 'Bad Regelsheim';
