/** Mission framework types. Pure module. */
import type { OffenceId } from '../rules/catalog';
import type { Bureaucracy } from '../systems/Bureaucracy';
import type { Clock } from '../systems/Clock';

/** Tile-space rectangle (x/y/w/h in tiles). */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What missions can see each frame. Positions are in tiles (fractional). */
export interface MissionSnap {
  mode: 'car' | 'foot';
  px: number;
  py: number;
  carX: number;
  carY: number;
  carSpeedKmh: number;
  carInBay: boolean;
  disc: boolean;
  belt: boolean;
  /** SPACE pressed this frame while on foot. */
  interact: boolean;
  dogX: number | null;
  dogY: number | null;
  /** Game minutes elapsed this frame. */
  gameDt: number;
}

export type MissionCmd =
  | {
      type: 'place';
      mode: 'car' | 'foot';
      player?: { x: number; y: number };
      car: { x: number; y: number; heading: number };
      disc?: boolean;
    }
  | { type: 'clock'; day: number; h: number; m: number }
  | { type: 'toast'; text: string }
  | { type: 'banner'; text: string; sub?: string }
  | { type: 'fine'; id: OffenceId; detail?: string }
  | { type: 'dog'; on: boolean }
  | { type: 'poop'; id: number; x: number; y: number }
  | { type: 'poopGone'; id: number }
  | { type: 'ambulance' }
  | { type: 'sfx'; name: 'ok' | 'stamp' | 'fanfare' };

export interface MissionCtx {
  clock: Clock;
  bureau: Bureaucracy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flags: Record<string, any>;
  emit(cmd: MissionCmd): void;
}

export type ObjectiveResult = boolean | 'fail';

export interface Objective {
  text: string | ((ctx: MissionCtx) => string);
  /** Waypoint shown on screen and minimap. */
  target?: Area;
  /** Clock minute after which the mission fails. */
  deadline?: number;
  start?(ctx: MissionCtx): void;
  update(s: MissionSnap, ctx: MissionCtx, dt: number): ObjectiveResult;
}

export interface Letter {
  from: string;
  subject: string;
  body: string[];
  az?: string;
  /** Rows rendered as a table (label, amount). */
  table?: { label: string; amount: number }[];
  stamp?: string;
}

export interface Mission {
  id: number;
  title: string;
  letter: Letter;
  setup(ctx: MissionCtx): void;
  objectives: Objective[];
  tick?(s: MissionSnap, ctx: MissionCtx, dt: number, objIndex: number): void;
  pay: number;
  payLabel: string;
  fee?: { amount: number; label: string };
  completeNote?(ctx: MissionCtx): string[];
  failText?: string;
  /** Last mission: completion triggers the ending instead of payment. */
  final?: boolean;
}
