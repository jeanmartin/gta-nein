/** Pure tile-map data model plus the builder that rasterises the city layout. */
import { TILE } from '../config';
import {
  BIKE_STRIPS,
  BLITZERS,
  CITY,
  CONTAINERS,
  CONTROLS,
  FOUNTAIN,
  FOUNTAIN_RING,
  LANDESAMT_PATH,
  MAP_H,
  MAP_W,
  PARK,
  POIS,
  RENTNER_NAMES,
  STREETS,
  TUNNELS,
  WERTSTOFF_PLAZA,
  ZEBRAS,
  ZONE_OVERRIDES,
  type PoiDef,
  type Rect,
  type StreetDef,
} from './cityLayout';
import {
  BIT,
  CARDS,
  F,
  T,
  VEC,
  Z,
  ZONE_LIMIT,
  axisOf,
  hash2,
  opposite,
  rightOf,
  type Axis,
  type Card,
} from './types';

export type Control = 'light' | 'stop' | 'rvl' | 'curve';

export interface Intersection {
  id: number;
  key: string;
  hId: string;
  vId: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  control: Control;
  stopAxis?: Axis;
  /** Extra ring of tiles (crosswalks) that belongs to the junction box. */
  margin: number;
  offset: number;
  cx: number;
  cy: number;
}

export interface SignDef {
  x: number;
  y: number;
  kind: 'limit' | 'stop' | 'autobahn' | 'spiel';
  value?: number;
}
export interface LightHeadDef {
  x: number;
  y: number;
  isect: number;
  axis: Axis;
  ped: boolean;
}
export interface RentnerDef {
  x: number;
  y: number;
  name: string;
}

export class MapData {
  readonly w = MAP_W;
  readonly h = MAP_H;
  readonly n = MAP_W * MAP_H;
  readonly type = new Uint8Array(this.n);
  readonly flags = new Uint8Array(this.n);
  readonly dir = new Uint8Array(this.n);
  readonly zone = new Uint8Array(this.n);
  readonly region = new Int16Array(this.n).fill(-1);
  readonly box = new Int16Array(this.n).fill(-1);
  readonly approach = new Int16Array(this.n).fill(-1);
  readonly street = new Int16Array(this.n).fill(-1);
  readonly lot = new Int32Array(this.n);
  /** For crosswalk tiles: 1 = lies on a horizontal road, 2 = on a vertical road. */
  readonly crossAxis = new Uint8Array(this.n);
  readonly zebra = new Int16Array(this.n).fill(-1);

  readonly streets: StreetDef[] = STREETS;
  readonly intersections: Intersection[] = [];
  readonly signs: SignDef[] = [];
  readonly lightHeads: LightHeadDef[] = [];
  readonly rentner: RentnerDef[] = [];
  readonly blitzers: { x: number; y: number }[] = [];
  readonly pois: PoiDef[] = POIS;
  /** Lane tiles suitable for spawning NPC cars. */
  readonly spawnLanes: number[] = [];
  /** Tiles suitable for spawning pedestrians. */
  readonly spawnWalk: number[] = [];

  idx(x: number, y: number): number {
    return y * this.w + x;
  }
  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  typeAt(x: number, y: number): number {
    return this.inb(x, y) ? this.type[this.idx(x, y)] : T.BUILDING;
  }
  isRoad(x: number, y: number): boolean {
    return this.inb(x, y) && this.type[this.idx(x, y)] === T.ROAD;
  }
  isSolidTile(x: number, y: number): boolean {
    if (!this.inb(x, y)) return true;
    const i = this.idx(x, y);
    const t = this.type[i];
    return t === T.BUILDING || t === T.WATER || (this.flags[i] & F.SOLID) !== 0;
  }
  isSolidPx(px: number, py: number): boolean {
    return this.isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE));
  }
  /** Tiles NPC pedestrians are happy to walk on. */
  pedWalkable(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    if (this.flags[i] & F.SOLID) return false;
    if (this.flags[i] & F.CROSSWALK) return true;
    const t = this.type[i];
    return t === T.SIDEWALK || t === T.PATH || t === T.DRIVEWAY;
  }
  limitAt(x: number, y: number): number {
    return this.inb(x, y) ? ZONE_LIMIT[this.zone[this.idx(x, y)]] : Infinity;
  }
  poi(id: string): PoiDef {
    const p = this.pois.find((q) => q.id === id);
    if (!p) throw new Error(`Unknown POI ${id}`);
    return p;
  }
  streetOf(x: number, y: number): StreetDef | undefined {
    if (!this.inb(x, y)) return undefined;
    const s = this.street[this.idx(x, y)];
    return s >= 0 ? this.streets[s] : undefined;
  }
  /** The single travel direction of a lane tile, if it has exactly one. */
  laneCard(x: number, y: number): Card | null {
    if (!this.inb(x, y)) return null;
    const m = this.dir[this.idx(x, y)];
    for (const c of CARDS) if (m === BIT[c]) return c;
    return null;
  }
}

function forRect(r: Rect, fn: (x: number, y: number) => void): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) fn(x, y);
}

function inCity(x: number, y: number): boolean {
  return x >= CITY.x0 && x <= CITY.x1 && y >= CITY.y0 && y <= CITY.y1;
}

function parseControl(s: string | undefined): { control: Control; stopAxis?: Axis } {
  switch (s) {
    case 'light':
      return { control: 'light' };
    case 'curve':
      return { control: 'curve' };
    case 'stopH':
      return { control: 'stop', stopAxis: 'h' };
    case 'stopV':
      return { control: 'stop', stopAxis: 'v' };
    default:
      return { control: 'rvl' };
  }
}

export const LIGHT_CYCLE_OFFSET_STEP = 7.3;

export function buildMap(): MapData {
  const m = new MapData();
  const { w, h } = m;

  // 1. Base: grass everywhere; rural outside the city, lawn inside.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) m.flags[m.idx(x, y)] = inCity(x, y) ? F.LAWN : F.RURAL;

  // 2. Streets.
  STREETS.forEach((s, si) => {
    for (let a = s.from; a <= s.to; a++) {
      for (let l = 0; l < s.lanes; l++) {
        const x = s.axis === 'h' ? a : s.at + l;
        const y = s.axis === 'h' ? s.at + l : a;
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        m.type[i] = T.ROAD;
        m.zone[i] = s.zone;
        m.street[i] = si;
        let card: Card;
        if (s.oneWay) card = s.oneWay;
        else if (s.axis === 'h') card = l < s.lanes / 2 ? 'W' : 'E';
        else card = l < s.lanes / 2 ? 'S' : 'N';
        m.dir[i] = BIT[card];
        m.flags[i] &= ~F.LAWN;
      }
    }
  });

  // 3. Intersections.
  const seen = new Set<string>();
  for (const hs of STREETS.filter((s) => s.axis === 'h')) {
    for (const vs of STREETS.filter((s) => s.axis === 'v')) {
      const x0 = vs.at;
      const x1 = vs.at + vs.lanes - 1;
      const y0 = hs.at;
      const y1 = hs.at + hs.lanes - 1;
      if (x0 < hs.from || x1 > hs.to || y0 < vs.from || y1 > vs.to) continue;
      const rkey = `${x0},${y0}`;
      if (seen.has(rkey)) continue;
      seen.add(rkey);
      const key = `${hs.id}|${vs.id}`;
      const { control, stopAxis } = parseControl(CONTROLS[key]);
      const id = m.intersections.length;
      m.intersections.push({
        id,
        key,
        hId: hs.id,
        vId: vs.id,
        x0,
        y0,
        x1,
        y1,
        control,
        stopAxis,
        margin: control === 'light' ? 1 : 0,
        offset: (id * LIGHT_CYCLE_OFFSET_STEP) % 29,
        cx: ((x0 + x1 + 1) / 2) * TILE,
        cy: ((y0 + y1 + 1) / 2) * TILE,
      });
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = m.idx(x, y);
          m.region[i] = id;
          m.box[i] = id;
          m.dir[i] = 15;
          m.zone[i] = hs.zone;
        }
    }
  }

  // 4. Zone overrides and tunnels.
  for (const o of ZONE_OVERRIDES)
    forRect(o.rect, (x, y) => {
      if (m.isRoad(x, y)) m.zone[m.idx(x, y)] = o.zone;
    });
  for (const t of TUNNELS)
    forRect(t, (x, y) => {
      if (m.isRoad(x, y)) m.flags[m.idx(x, y)] |= F.TUNNEL;
    });

  // 5. Crosswalks at traffic lights (they belong to the junction box).
  for (const is of m.intersections) {
    if (is.control !== 'light') continue;
    const mark = (x: number, y: number, axis: 1 | 2) => {
      if (!m.isRoad(x, y)) return;
      const i = m.idx(x, y);
      if (m.region[i] >= 0) return;
      m.flags[i] |= F.CROSSWALK;
      m.crossAxis[i] = axis;
      m.box[i] = is.id;
    };
    for (let y = is.y0; y <= is.y1; y++) {
      mark(is.x0 - 1, y, 1);
      mark(is.x1 + 1, y, 1);
    }
    for (let x = is.x0; x <= is.x1; x++) {
      mark(x, is.y0 - 1, 2);
      mark(x, is.y1 + 1, 2);
    }
  }

  // 6. Zebra crossings.
  ZEBRAS.forEach((z, zi) => {
    const s = m.streetOf(z.x, z.y);
    const lanes = s ? s.lanes : 2;
    for (let l = 0; l < lanes; l++) {
      const x = z.axis === 'h' ? z.x : z.x + l;
      const y = z.axis === 'h' ? z.y + l : z.y;
      if (!m.isRoad(x, y)) continue;
      const i = m.idx(x, y);
      m.flags[i] |= F.CROSSWALK | F.ZEBRA;
      m.crossAxis[i] = z.axis === 'h' ? 1 : 2;
      m.zebra[i] = zi;
    }
  });

  // 7. Stop-sign approach zones (3 tiles before the junction on the stop axis).
  for (const is of m.intersections) {
    if (is.control !== 'stop') continue;
    for (let k = 1; k <= 3; k++) {
      if (is.stopAxis === 'h') {
        for (let y = is.y0; y <= is.y1; y++) {
          for (const x of [is.x0 - k, is.x1 + k])
            if (m.isRoad(x, y) && m.region[m.idx(x, y)] < 0) m.approach[m.idx(x, y)] = is.id;
        }
      } else {
        for (let x = is.x0; x <= is.x1; x++) {
          for (const y of [is.y0 - k, is.y1 + k])
            if (m.isRoad(x, y) && m.region[m.idx(x, y)] < 0) m.approach[m.idx(x, y)] = is.id;
        }
      }
    }
  }

  // 8. Sidewalks around city roads.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = m.idx(x, y);
      if (m.type[i] !== T.GRASS || !inCity(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) if (m.isRoad(x + dx, y + dy)) near = true;
      if (near) {
        m.type[i] = T.SIDEWALK;
        m.flags[i] &= ~F.LAWN;
      }
    }

  // 9. Bike strips on Bahnhofstraße.
  for (const b of BIKE_STRIPS) {
    forRect(b.walk, (x, y) => {
      const i = m.idx(x, y);
      m.type[i] = T.SIDEWALK;
      m.flags[i] &= ~F.LAWN;
    });
    forRect(b.bike, (x, y) => {
      m.type[m.idx(x, y)] = T.BIKE;
    });
  }

  // 10. Park with paths and a fountain.
  forRect(PARK, (x, y) => {
    const i = m.idx(x, y);
    m.type[i] = T.GRASS;
    m.flags[i] |= F.LAWN;
    m.lot[i] = -1;
  });
  const setPath = (x: number, y: number) => {
    const i = m.idx(x, y);
    m.type[i] = T.PATH;
    m.flags[i] &= ~F.LAWN;
  };
  for (let x = PARK.x; x < PARK.x + PARK.w; x++) setPath(x, 55);
  for (let y = PARK.y; y < PARK.y + PARK.h; y++) setPath(22, y);
  forRect(FOUNTAIN_RING, setPath);
  forRect(FOUNTAIN, (x, y) => {
    m.type[m.idx(x, y)] = T.WATER;
  });

  // 11. Points of interest: buildings, lots, driveways.
  POIS.forEach((p, pi) => {
    forRect(p.rect, (x, y) => {
      const i = m.idx(x, y);
      m.type[i] = T.BUILDING;
      m.lot[i] = pi + 1;
      m.flags[i] &= ~F.LAWN;
    });
    if (p.lot) applyLot(m, p.lot);
  });
  forRect(WERTSTOFF_PLAZA, setPath);
  forRect(LANDESAMT_PATH, setPath);
  for (const c of CONTAINERS) m.flags[m.idx(c.x, c.y)] |= F.SOLID;

  // 12. Every remaining city tile becomes a building (split into lots for variety).
  for (let y = CITY.y0; y <= CITY.y1; y++)
    for (let x = CITY.x0; x <= CITY.x1; x++) {
      const i = m.idx(x, y);
      if (m.type[i] !== T.GRASS) continue;
      if (x >= PARK.x && x < PARK.x + PARK.w && y >= PARK.y && y < PARK.y + PARK.h) continue;
      m.type[i] = T.BUILDING;
      m.flags[i] &= ~F.LAWN;
      m.lot[i] = 100000 + Math.floor((x + 1) / 5) * 1000 + Math.floor((y + 1) / 4);
    }

  // 13. Derived data: signs, lights, Rentner, Blitzer, spawn tiles.
  placeSignsAndLights(m);
  placeRentner(m);
  for (const b of BLITZERS) if (m.typeAt(b.x, b.y) === T.SIDEWALK) m.blitzers.push(b);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = m.idx(x, y);
      if (
        m.type[i] === T.ROAD &&
        m.box[i] < 0 &&
        m.approach[i] < 0 &&
        !(m.flags[i] & F.CROSSWALK) &&
        m.zone[i] !== Z.SPIEL &&
        m.laneCard(x, y)
      )
        m.spawnLanes.push(i);
      if ((m.type[i] === T.SIDEWALK || m.type[i] === T.PATH) && !(m.flags[i] & F.SOLID)) m.spawnWalk.push(i);
    }
  return m;
}

function applyLot(m: MapData, lot: { x: number; y: number; w: number; h: number; street: Card }): void {
  const [sx, sy] = VEC[lot.street];
  for (let y = lot.y; y < lot.y + lot.h; y++)
    for (let x = lot.x; x < lot.x + lot.w; x++) {
      const i = m.idx(x, y);
      // Distance (in rows/cols) from the street-facing edge.
      let d: number;
      if (lot.street === 'N') d = y - lot.y;
      else if (lot.street === 'S') d = lot.y + lot.h - 1 - y;
      else if (lot.street === 'W') d = x - lot.x;
      else d = lot.x + lot.w - 1 - x;
      m.type[i] = d < 2 ? T.LOT : T.PARKING;
      m.zone[i] = Z.LOT;
      m.flags[i] &= ~F.LAWN;
    }
  // Driveway across the sidewalk (or verge) between lot and street.
  const dw: [number, number][] = [];
  if (sx === 0) for (let x = lot.x; x < lot.x + lot.w; x++) dw.push([x, sy < 0 ? lot.y - 1 : lot.y + lot.h]);
  else for (let y = lot.y; y < lot.y + lot.h; y++) dw.push([sx < 0 ? lot.x - 1 : lot.x + lot.w, y]);
  for (const [x, y] of dw) {
    const i = m.idx(x, y);
    if (m.type[i] !== T.ROAD) {
      m.type[i] = T.DRIVEWAY;
      m.zone[i] = Z.LOT;
      m.flags[i] &= ~F.LAWN;
    }
  }
}

/** Tile position of the traffic light / stop sign for traffic heading `c` into `is`. */
export function approachPost(is: Intersection, c: Card): { x: number; y: number; laneX: number; laneY: number } {
  const mg = is.margin;
  switch (c) {
    case 'E':
      return { x: is.x0 - mg - 1, y: is.y1 + 1, laneX: is.x0 - mg - 1, laneY: is.y1 };
    case 'W':
      return { x: is.x1 + mg + 1, y: is.y0 - 1, laneX: is.x1 + mg + 1, laneY: is.y0 };
    case 'S':
      return { x: is.x0 - 1, y: is.y0 - mg - 1, laneX: is.x0, laneY: is.y0 - mg - 1 };
    case 'N':
      return { x: is.x1 + 1, y: is.y1 + mg + 1, laneX: is.x1, laneY: is.y1 + mg + 1 };
  }
}

function placeSignsAndLights(m: MapData): void {
  const towardRoad = (c: Card): [number, number] => {
    const [lx, ly] = VEC[opposite(rightOf(c))];
    return [lx * 9, ly * 9];
  };
  for (const is of m.intersections) {
    for (const c of CARDS) {
      const post = approachPost(is, c);
      if (!m.isRoad(post.laneX, post.laneY) || !(m.dir[m.idx(post.laneX, post.laneY)] & BIT[c])) continue;
      if (m.isRoad(post.x, post.y)) continue;
      const [ox, oy] = towardRoad(c);
      const px = post.x * TILE + TILE / 2 + ox;
      const py = post.y * TILE + TILE / 2 + oy;
      if (is.control === 'light') {
        m.lightHeads.push({ x: px, y: py, isect: is.id, axis: axisOf(c), ped: false });
        // Pedestrian light for the crosswalk next to the post (crossing the other road).
        const [bx, by] = VEC[c];
        m.lightHeads.push({
          x: px + bx * 10 - ox * 0.2,
          y: py + by * 10 - oy * 0.2,
          isect: is.id,
          axis: axisOf(c) === 'h' ? 'h' : 'v',
          ped: true,
        });
      } else if (is.control === 'stop' && is.stopAxis === axisOf(c)) {
        m.signs.push({ x: px, y: py, kind: 'stop' });
      }
    }
    // Zone reminder signs on the exits of the junction.
    for (const e of CARDS) {
      const ex = exitLaneTile(m, is, e);
      if (!ex) continue;
      const zi = m.zone[m.idx(ex.x, ex.y)];
      const before = zoneBefore(m, is, e);
      const special = zi === Z.Z30 || zi === Z.SPIEL || zi === Z.LAND || zi === Z.AUTOBAHN;
      if (!special && zi === before) continue;
      if (zi === Z.NONE || zi === Z.LOT) continue;
      const [rx, ry] = VEC[rightOf(e)];
      let sx = ex.x + rx;
      let sy = ex.y + ry;
      let guard = 0;
      while (m.isRoad(sx, sy) && guard++ < 4) {
        sx += rx;
        sy += ry;
      }
      if (!m.inb(sx, sy)) continue;
      const [ox, oy] = [-rx * 9, -ry * 9];
      const px = sx * TILE + TILE / 2 + ox;
      const py = sy * TILE + TILE / 2 + oy;
      if (zi === Z.AUTOBAHN) m.signs.push({ x: px, y: py, kind: 'autobahn' });
      else if (zi === Z.SPIEL) m.signs.push({ x: px, y: py, kind: 'spiel' });
      else m.signs.push({ x: px, y: py, kind: 'limit', value: ZONE_LIMIT[zi] });
    }
  }
}

/** Outermost lane tile just beyond the junction box in direction `e`. */
function exitLaneTile(m: MapData, is: Intersection, e: Card): { x: number; y: number } | null {
  const mg = is.margin;
  const cands: [number, number][] = [];
  if (e === 'E') for (let y = is.y0; y <= is.y1; y++) cands.push([is.x1 + mg + 1, y]);
  if (e === 'W') for (let y = is.y0; y <= is.y1; y++) cands.push([is.x0 - mg - 1, y]);
  if (e === 'S') for (let x = is.x0; x <= is.x1; x++) cands.push([x, is.y1 + mg + 1]);
  if (e === 'N') for (let x = is.x0; x <= is.x1; x++) cands.push([x, is.y0 - mg - 1]);
  const ok = cands.filter(([x, y]) => m.isRoad(x, y) && m.dir[m.idx(x, y)] & BIT[e]);
  if (!ok.length) return null;
  const [rx, ry] = VEC[rightOf(e)];
  ok.sort((a, b) => b[0] * rx + b[1] * ry - (a[0] * rx + a[1] * ry));
  return { x: ok[0][0], y: ok[0][1] };
}

function zoneBefore(m: MapData, is: Intersection, e: Card): number {
  const mg = is.margin;
  const pts: [number, number][] = [];
  if (e === 'E') pts.push([is.x0 - mg - 1, is.y1]);
  if (e === 'W') pts.push([is.x1 + mg + 1, is.y0]);
  if (e === 'S') pts.push([is.x0, is.y0 - mg - 1]);
  if (e === 'N') pts.push([is.x1, is.y1 + mg + 1]);
  for (const [x, y] of pts) if (m.isRoad(x, y)) return m.zone[m.idx(x, y)];
  return Z.Z50;
}

function placeRentner(m: MapData): void {
  let n = 0;
  for (let y = CITY.y0; y <= CITY.y1; y++)
    for (let x = CITY.x0; x <= CITY.x1; x++) {
      const i = m.idx(x, y);
      if (m.type[i] !== T.BUILDING || m.lot[i] < 100000) continue;
      if (hash2(x, y, 7) > 0.06) continue;
      const nearWalk = CARDS.some((c) => {
        const [dx, dy] = VEC[c];
        return m.typeAt(x + dx, y + dy) === T.SIDEWALK;
      });
      if (!nearWalk) continue;
      if (m.rentner.some((r) => Math.abs(r.x - x) + Math.abs(r.y - y) < 14)) continue;
      m.rentner.push({ x, y, name: RENTNER_NAMES[n++ % RENTNER_NAMES.length] });
    }
}
