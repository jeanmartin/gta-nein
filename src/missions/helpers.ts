/** Objective builders shared by all missions. Pure module. */
import { POIS, type PoiDef } from '../world/cityLayout';
import type { Area, MissionCtx, MissionSnap, Objective } from './types';

export const area = (x: number, y: number, w = 1, h = 1): Area => ({ x, y, w, h });

export function inArea(x: number, y: number, a: Area): boolean {
  return x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h;
}

export function poi(id: string): PoiDef {
  const p = POIS.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown POI ${id}`);
  return p;
}

/** The three sidewalk tiles in front of a building's door. */
export function doorArea(id: string): Area {
  const d = poi(id).door;
  return area(d.x - 1, d.y, 3, 1);
}

export function lotArea(id: string): Area {
  const l = poi(id).lot;
  if (!l) throw new Error(`POI ${id} has no lot`);
  return area(l.x, l.y, l.w, l.h);
}

/** Centre of the first parking bay of a POI lot, plus the heading facing the aisle. */
export function bayOf(id: string, n = 0): { x: number; y: number; heading: number } {
  const l = poi(id).lot;
  if (!l) throw new Error(`POI ${id} has no lot`);
  switch (l.street) {
    case 'N':
      return { x: l.x + n + 0.5, y: l.y + l.h - 0.5, heading: -Math.PI / 2 };
    case 'S':
      return { x: l.x + n + 0.5, y: l.y + 0.5, heading: Math.PI / 2 };
    case 'W':
      return { x: l.x + l.w - 0.5, y: l.y + n + 0.5, heading: Math.PI };
    case 'E':
      return { x: l.x + 0.5, y: l.y + n + 0.5, heading: 0 };
  }
}

export function doorPos(id: string): { x: number; y: number } {
  const d = poi(id).door;
  return { x: d.x + 0.5, y: d.y + 0.5 };
}

export function reach(
  text: string | ((ctx: MissionCtx) => string),
  target: Area,
  mode: 'car' | 'foot' | 'any',
  deadline?: number,
): Objective {
  return {
    text,
    target,
    deadline,
    update: (s: MissionSnap) => (mode === 'any' || s.mode === mode) && inArea(s.px, s.py, target),
  };
}

/** Car parked in a bay inside `lot`, Parkscheibe set, player on foot. */
export function parkIn(text: string, lot: Area, deadline?: number): Objective {
  return {
    text: (ctx) => (ctx.flags.parkHint ? `${text} ${ctx.flags.parkHint}` : text),
    target: lot,
    deadline,
    update: (s, ctx) => {
      const inLot = inArea(s.carX, s.carY, lot);
      ctx.flags.parkHint =
        s.mode === 'foot' && inLot && s.carInBay && !s.disc ? '— Parkscheibe missing! Get back in and press P.' : '';
      return s.mode === 'foot' && inLot && s.carInBay && s.disc;
    },
  };
}

export function interactAt(text: string, target: Area, deadline?: number): Objective {
  return {
    text,
    target,
    deadline,
    update: (s) => s.mode === 'foot' && s.interact && inArea(s.px, s.py, target),
  };
}

export const HM = (h: number, m = 0): number => h * 60 + m;
