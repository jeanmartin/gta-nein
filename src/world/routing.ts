/** Lane-level routing through intersections for NPC traffic. Pure module. */
import type { Intersection, MapData } from './MapData';
import { BIT, CARDS, VEC, axisOf, opposite, type Card } from './types';

export interface Waypoint {
  x: number;
  y: number;
  c: Card;
  /** Junction id that must allow entry before driving onto this tile. */
  gate?: number;
}

export interface Exit {
  card: Card;
  path: Waypoint[];
}

/**
 * All legal ways through `is` for a vehicle entering region tile (ex, ey) heading `d`.
 * The returned path starts with the entry tile and ends on the first tile outside the region.
 */
export function exitsFor(map: MapData, is: Intersection, ex: number, ey: number, d: Card): Exit[] {
  const res: Exit[] = [];
  for (const e of CARDS) {
    if (e === opposite(d)) continue;
    const cands: [number, number][] = [];
    if (e === 'N') for (let x = is.x0; x <= is.x1; x++) cands.push([x, is.y0 - 1]);
    if (e === 'S') for (let x = is.x0; x <= is.x1; x++) cands.push([x, is.y1 + 1]);
    if (e === 'E') for (let y = is.y0; y <= is.y1; y++) cands.push([is.x1 + 1, y]);
    if (e === 'W') for (let y = is.y0; y <= is.y1; y++) cands.push([is.x0 - 1, y]);
    const ok = cands.filter(
      ([x, y]) => map.isRoad(x, y) && map.region[map.idx(x, y)] < 0 && (map.dir[map.idx(x, y)] & BIT[e]) !== 0,
    );
    if (!ok.length) continue;
    let target: [number, number] | undefined;
    if (e === d) target = ok.find(([x, y]) => (axisOf(d) === 'h' ? y === ey : x === ex));
    else target = ok.reduce((a, b) => (Math.abs(a[0] - ex) + Math.abs(a[1] - ey) <= Math.abs(b[0] - ex) + Math.abs(b[1] - ey) ? a : b));
    if (!target) continue;
    const path: Waypoint[] = [{ x: ex, y: ey, c: d }];
    let cx = ex;
    let cy = ey;
    let guard = 0;
    const [dx, dy] = VEC[d];
    if (e !== d) {
      if (axisOf(d) === 'h') {
        while (cx !== target[0] && guard++ < 12) {
          cx += dx;
          path.push({ x: cx, y: cy, c: d });
        }
      } else {
        while (cy !== target[1] && guard++ < 12) {
          cy += dy;
          path.push({ x: cx, y: cy, c: d });
        }
      }
    }
    const [sx, sy] = VEC[e];
    while (!(cx === target[0] && cy === target[1]) && guard++ < 24) {
      cx += sx;
      cy += sy;
      path.push({ x: cx, y: cy, c: e });
    }
    if (guard >= 24) continue;
    res.push({ card: e, path });
  }
  return res;
}

/** Weighted random choice: straight is preferred. */
export function chooseExit(exits: Exit[], from: Card, rnd: number): Exit | undefined {
  if (!exits.length) return undefined;
  const w = exits.map((x) => (x.card === from ? 2 : 1));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rnd * total;
  for (let i = 0; i < exits.length; i++) {
    r -= w[i];
    if (r < 0) return exits[i];
  }
  return exits[exits.length - 1];
}
