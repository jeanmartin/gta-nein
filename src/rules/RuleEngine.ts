/**
 * Watches the player and turns every misstep into a Violation.
 * Pure module: works on plain snapshots so it can be unit-tested without Phaser.
 */
import { TILE } from '../config';
import type { Clock } from '../systems/Clock';
import { LOITER_RECT } from '../world/cityLayout';
import type { Intersection, MapData, RentnerDef } from '../world/MapData';
import { lampFor, lightAt, pedGreen } from '../world/TrafficLights';
import {
  AUTOBAHN_MIN_KMH,
  BIT,
  CARDS,
  F,
  T,
  VEC,
  Z,
  ZONE_LIMIT,
  axisOf,
  cardFromVec,
  leftOf,
  relTurn,
  rightOf,
  type Card,
} from '../world/types';
import { speedOffence, type OffenceId } from './catalog';

export interface PlayerInfo {
  mode: 'car' | 'foot';
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  /** Signed: negative when reversing. */
  speedKmh: number;
  belt: boolean;
  lights: boolean;
  blinker: -1 | 0 | 1;
}

export interface VehicleInfo {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
}

export interface PedInfo {
  x: number;
  y: number;
}

export interface Snapshot {
  /** Real seconds since game start (drives the traffic lights). */
  t: number;
  clock: Clock;
  player: PlayerInfo;
  npcs: VehicleInfo[];
  peds: PedInfo[];
  ambulance: VehicleInfo | null;
}

export interface Violation {
  id: OffenceId;
  detail?: string;
}

export type RuleEvent =
  | { type: 'horn' }
  | { type: 'exitCar'; x: number; y: number; disc: boolean }
  | { type: 'collision'; with: 'building' | 'object' | 'car' | 'ped'; speedKmh: number }
  | { type: 'hitByCar' }
  | { type: 'theft' };

interface Timer {
  acc: number;
  since: number;
}

const NOT_WITNESSED: ReadonlySet<OffenceId> = new Set<OffenceId>([
  'anzeige',
  'photo_fee',
  'glass_quiet',
  'wrong_bin',
  'dog_poop',
  'early',
  'late',
  'min_speed',
  'tolerance_fee',
]);

export class RuleEngine {
  /** Live status for the HUD. */
  readonly status: { rescueLane: boolean | null; pedLight: 'red' | 'green' | null } = {
    rescueLane: null,
    pedLight: null,
  };
  /** Non-violation events from the last update (e.g. 'turnDone'). */
  events: string[] = [];

  private timers = new Map<string, Timer>();
  private cooldowns = new Map<string, number>();
  private prevMode: 'car' | 'foot' | null = null;
  private prevTx = -1;
  private prevTy = -1;
  private prevBox = -1;
  private prevZebra = -1;
  private prevCross = false;
  private prevLane: { street: number; card: Card; coord: number; tx: number; ty: number } | null = null;
  private entry: { id: number; card: Card; blinker: number } | null = null;
  private stopped = new Set<number>();
  private curBlinker = 0;
  private lastBlinkerDir = 0;
  private lastBlinkerT = -99;
  private blinkerOn = 0;
  private overtake = new Map<number, number>();
  private loiter = 0;
  private autobahnTime = 0;
  /** Seatbelt: seconds driven unbuckled, and whether this "episode" was already warned/fined. */
  private beltT = 0;
  private beltWarned = false;
  private beltFined = false;
  private witnessCd = new Map<string, number>();

  constructor(private readonly map: MapData) {}

  reset(): void {
    this.timers.clear();
    this.cooldowns.clear();
    this.prevMode = null;
    this.entry = null;
    this.stopped.clear();
    this.overtake.clear();
    this.prevLane = null;
    this.loiter = 0;
    this.blinkerOn = 0;
    this.status.rescueLane = null;
    this.status.pedLight = null;
  }

  update(s: Snapshot, dt: number): Violation[] {
    const out: Violation[] = [];
    this.events = [];
    const m = this.map;
    const p = s.player;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    if (!m.inb(tx, ty)) return out;
    const i = m.idx(tx, ty);

    if (p.mode !== this.prevMode) {
      // Fresh start in the new mode: no fake transitions.
      this.timers.clear();
      this.entry = null;
      this.prevTx = tx;
      this.prevTy = ty;
      this.prevBox = m.box[i];
      this.prevZebra = m.zebra[i];
      this.prevCross = (m.flags[i] & F.CROSSWALK) !== 0 && m.box[i] >= 0;
      this.prevLane = null;
      this.prevMode = p.mode;
      this.resetBelt();
    }

    if (p.mode === 'car') this.carRules(s, dt, tx, ty, i, out);
    else this.footRules(s, dt, tx, ty, i, out);

    this.prevTx = tx;
    this.prevTy = ty;
    return out;
  }

  // ───────────────────────────── driving ─────────────────────────────
  private carRules(s: Snapshot, dt: number, tx: number, ty: number, i: number, out: Violation[]): void {
    const m = this.map;
    const p = s.player;
    const type = m.type[i];
    const flags = m.flags[i];
    const zone = m.zone[i];
    const spd = Math.abs(p.speedKmh);
    const moving = spd > 2;
    this.status.pedLight = null;

    // Blinker bookkeeping.
    this.curBlinker = p.blinker;
    if (p.blinker !== 0) {
      this.lastBlinkerDir = p.blinker;
      this.lastBlinkerT = s.t;
      this.blinkerOn += dt;
    } else this.blinkerOn = 0;
    if (this.cont('blinkerLong', this.blinkerOn > 15, dt, 0, 15)) out.push({ id: 'blinker_forever' });

    // Seatbelt: a warning chime first, then ONE fine per unbuckled episode.
    if (p.belt) this.resetBelt();
    else if (moving) {
      this.beltT += dt;
      if (this.beltT > 0.8 && !this.beltWarned) {
        this.beltWarned = true;
        this.events.push('beltWarning');
      }
      if (this.beltT > 3 && !this.beltFined) {
        this.beltFined = true;
        out.push({ id: 'no_belt' });
      }
    }

    // Speed.
    const limit = ZONE_LIMIT[zone];
    const measured = Math.round(spd);
    if (this.cont('speed', Number.isFinite(limit) && measured > limit, dt, 0.25, 4)) out.push(speedOffence(measured, limit));

    const onAutobahn = zone === Z.AUTOBAHN && type === T.ROAD && m.region[i] < 0;
    this.autobahnTime = onAutobahn ? this.autobahnTime + dt : 0;
    if (
      this.cont(
        'minspeed',
        onAutobahn && this.autobahnTime > 4 && p.speedKmh < AUTOBAHN_MIN_KMH && !s.ambulance,
        dt,
        3,
        8,
      )
    )
      out.push({ id: 'min_speed', detail: `${measured} km/h (minimum ${AUTOBAHN_MIN_KMH} km/h)` });

    // Lights.
    const tunnel = (flags & F.TUNNEL) !== 0;
    if (this.cont('lights', (tunnel || s.clock.isNight) && !p.lights && moving, dt, 0.6, 8))
      out.push({ id: tunnel ? 'no_lights_tunnel' : 'no_lights_night' });

    // Surfaces.
    let off: OffenceId | null = null;
    if (!(flags & F.CROSSWALK)) {
      if (type === T.SIDEWALK || type === T.PATH) off = 'sidewalk_drive';
      else if (type === T.BIKE) off = 'bikelane_drive';
      else if (type === T.GRASS) off = flags & F.RURAL ? 'field_drive' : 'lawn_drive';
    }
    if (this.cont('offroad', off !== null && moving, dt, 0.25, 4) && off) out.push({ id: off });

    // Wrong way / keep right (only when moving along the lane axis).
    let wrong: OffenceId | null = null;
    const vcard = spd > 6 ? cardFromVec(p.vx, p.vy, 35) : null;
    if (type === T.ROAD && m.region[i] < 0 && vcard) {
      const mask = m.dir[i];
      const laneAxis = mask & (BIT.E | BIT.W) ? 'h' : 'v';
      if (mask && !(mask & BIT[vcard]) && axisOf(vcard) === laneAxis) {
        const st = m.streetOf(tx, ty);
        wrong = zone === Z.AUTOBAHN ? 'ghost_driver' : st?.oneWay ? 'wrong_way_oneway' : 'keep_right';
      }
    }
    if (this.cont('wrong', wrong !== null, dt, 0.5, 6) && wrong) out.push({ id: wrong });

    // Stop sign: remember a full stop in the approach zone.
    const ap = m.approach[i];
    if (ap >= 0 && spd < 1) this.stopped.add(ap);

    // Junction box transitions.
    const box = m.box[i];
    if (box !== this.prevBox) {
      const dxT = tx - this.prevTx;
      const dyT = ty - this.prevTy;
      const card =
        Math.abs(dxT) + Math.abs(dyT) === 1 ? cardFromVec(dxT, dyT) : cardFromVec(p.vx, p.vy, 50);
      if (this.prevBox >= 0) this.exitBox(s, this.prevBox, card, out);
      if (box >= 0 && card) this.enterBox(s, box, card, out);
      this.prevBox = box;
    }

    // Zebra crossing with a pedestrian on it.
    const zb = m.zebra[i];
    if (zb >= 0 && zb !== this.prevZebra && moving) {
      const busy = s.peds.some((pd) => {
        const px = Math.floor(pd.x / TILE);
        const py = Math.floor(pd.y / TILE);
        return m.inb(px, py) && m.zebra[m.idx(px, py)] === zb;
      });
      if (busy) out.push({ id: 'zebra' });
    }
    this.prevZebra = zb;

    // Lane changes on multi-lane carriageways.
    const lc = type === T.ROAD && m.region[i] < 0 && !(flags & F.CROSSWALK) ? m.laneCard(tx, ty) : null;
    if (lc) {
      const si = m.street[i];
      const st = m.streets[si];
      const coord = st.axis === 'h' ? ty : tx;
      const pl = this.prevLane;
      if (pl && pl.street === si && pl.card === lc && Math.abs(coord - pl.coord) === 1) {
        const [rx, ry] = VEC[rightOf(lc)];
        const d = st.axis === 'h' ? (ty - pl.ty) * ry : (tx - pl.tx) * rx;
        const need = d > 0 ? 1 : -1;
        if (this.recentBlinker(s.t) !== need)
          out.push({ id: 'lane_change_no_blinker', detail: need > 0 ? 'Change to the right lane' : 'Change to the left lane' });
      }
      this.prevLane = { street: si, card: lc, coord, tx, ty };
    } else if (type !== T.ROAD || m.region[i] >= 0) this.prevLane = null;

    // Overtaking on the right (Autobahn).
    if (onAutobahn && lc) {
      const [fx, fy] = VEC[lc];
      const [rx, ry] = VEC[rightOf(lc)];
      const seen = new Set<number>();
      for (const n of s.npcs) {
        if (cardFromVec(Math.cos(n.heading), Math.sin(n.heading), 30) !== lc) continue;
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const along = dx * fx + dy * fy;
        const lat = dx * rx + dy * ry;
        if (Math.abs(along) > 220 || lat > -18 || lat < -50) continue;
        seen.add(n.id);
        const prev = this.overtake.get(n.id);
        if (prev !== undefined && prev > 0 && along <= 0 && p.speedKmh > 20) out.push({ id: 'overtake_right' });
        this.overtake.set(n.id, along);
      }
      for (const k of [...this.overtake.keys()]) if (!seen.has(k)) this.overtake.delete(k);
    } else this.overtake.clear();

    // Rettungsgasse.
    this.status.rescueLane = null;
    if (s.ambulance && onAutobahn && lc) {
      const a = s.ambulance;
      const acard = cardFromVec(a.vx, a.vy, 30);
      if (acard === lc) {
        const [fx, fy] = VEC[lc];
        const along = (a.x - p.x) * fx + (a.y - p.y) * fy;
        if (along < 64 && along > -16 * TILE) {
          const div = this.dividerOf(tx, ty, lc);
          const dist = Math.abs((axisOf(lc) === 'h' ? p.y : p.x) - div);
          const ok = dist >= 21;
          this.status.rescueLane = ok;
          if (this.cont('gasse', !ok, dt, 1.0, 999)) out.push({ id: 'no_rescue_lane' });
        }
      }
    }
    if (!s.ambulance) this.timers.delete('gasse');
  }

  private resetBelt(): void {
    this.beltT = 0;
    this.beltWarned = false;
    this.beltFined = false;
  }

  /** Pixel coordinate of the line between the two lanes of the carriageway. */
  dividerOf(tx: number, ty: number, card: Card): number {
    const st = this.map.streetOf(tx, ty);
    if (!st) return 0;
    const half = st.lanes / 2;
    const first = card === 'W' || card === 'S' ? 0 : half;
    return (st.at + first + 1) * TILE;
  }

  private recentBlinker(t: number): number {
    if (this.curBlinker !== 0) return this.curBlinker;
    return t - this.lastBlinkerT < 2.5 ? this.lastBlinkerDir : 0;
  }

  private enterBox(s: Snapshot, id: number, card: Card, out: Violation[]): void {
    const is = this.map.intersections[id];
    if (is.control === 'curve') {
      this.entry = null;
      return;
    }
    const ax = axisOf(card);
    if (is.control === 'light') {
      const lamp = lampFor(lightAt(s.t, is.offset), ax);
      if (lamp === 'red' || lamp === 'redamber') out.push({ id: 'red_light' });
      else if (lamp === 'amber') out.push({ id: 'amber_light' });
    } else if (is.control === 'stop' && is.stopAxis === ax) {
      if (!this.stopped.has(id)) out.push({ id: 'stop_sign' });
    } else if (is.control === 'rvl') {
      if (this.vehicleFromRight(s, is, card)) out.push({ id: 'right_before_left' });
    }
    this.entry = { id, card, blinker: this.recentBlinker(s.t) };
  }

  private exitBox(s: Snapshot, id: number, card: Card | null, out: Violation[]): void {
    const is = this.map.intersections[id];
    this.stopped.delete(id);
    const entry = this.entry;
    this.entry = null;
    if (!card || !entry || entry.id !== id || is.control === 'curve') return;
    const turn = relTurn(entry.card, card);
    const used = entry.blinker !== 0 ? entry.blinker : this.recentBlinker(s.t);
    if (turn === 'left' && used !== -1) out.push({ id: 'no_blinker', detail: 'Left turn without left indicator' });
    else if (turn === 'right' && used !== 1) out.push({ id: 'no_blinker', detail: 'Right turn without right indicator' });
    else if (turn === 'straight' && entry.blinker !== 0 && s.player.blinker !== 0) out.push({ id: 'misleading_blinker' });
    if (turn === 'left' || turn === 'right') this.events.push('turnDone');
  }

  private vehicleFromRight(s: Snapshot, is: Intersection, card: Card): boolean {
    const [rx, ry] = VEC[rightOf(card)];
    const travel = leftOf(card);
    return s.npcs.some((n) => {
      if (cardFromVec(Math.cos(n.heading), Math.sin(n.heading), 35) !== travel) return false;
      const dx = n.x - is.cx;
      const dy = n.y - is.cy;
      const side = dx * rx + dy * ry;
      const lat = Math.abs(dx * ry - dy * rx);
      return side > TILE * 0.8 && side < TILE * 6 && lat < TILE * 2;
    });
  }

  // ───────────────────────────── walking ─────────────────────────────
  private footRules(s: Snapshot, dt: number, tx: number, ty: number, i: number, out: Violation[]): void {
    const m = this.map;
    const type = m.type[i];
    const flags = m.flags[i];
    const onCross = (flags & F.CROSSWALK) !== 0;
    this.status.rescueLane = null;

    const roadish = type === T.ROAD && !onCross && m.zone[i] !== Z.SPIEL;
    if (this.cont('jaywalk', roadish, dt, 0.3, 5)) out.push({ id: 'jaywalk' });

    // Ampelmännchen.
    this.status.pedLight = null;
    const lightCross = onCross && m.box[i] >= 0;
    if (lightCross) {
      const is = m.intersections[m.box[i]];
      const green = pedGreen(lightAt(s.t, is.offset), m.crossAxis[i] === 1 ? 'h' : 'v');
      this.status.pedLight = green ? 'green' : 'red';
      if (!this.prevCross && !green) out.push({ id: 'red_ped' });
    } else {
      for (const c of CARDS) {
        const [dx, dy] = VEC[c];
        const nx = tx + dx;
        const ny = ty + dy;
        if (!m.inb(nx, ny)) continue;
        const ni = m.idx(nx, ny);
        if (m.flags[ni] & F.CROSSWALK && m.box[ni] >= 0) {
          const is = m.intersections[m.box[ni]];
          const green = pedGreen(lightAt(s.t, is.offset), m.crossAxis[ni] === 1 ? 'h' : 'v');
          this.status.pedLight = green ? 'green' : 'red';
          break;
        }
      }
    }
    this.prevCross = lightCross;

    if (this.cont('walkbike', type === T.BIKE && !onCross, dt, 0.4, 6)) out.push({ id: 'walk_bikelane' });
    if (this.cont('lawn', type === T.GRASS && (flags & F.LAWN) !== 0, dt, 0.3, 6)) out.push({ id: 'lawn' });

    const L = LOITER_RECT;
    const inL = tx >= L.x && tx < L.x + L.w && ty >= L.y && ty < L.y + L.h;
    this.loiter = inL ? this.loiter + dt : 0;
    if (this.cont('loiter', this.loiter > 6, dt, 0, 10)) out.push({ id: 'loitering' });
  }

  // ───────────────────────────── events ─────────────────────────────
  onEvent(e: RuleEvent, s: Snapshot): Violation[] {
    const m = this.map;
    switch (e.type) {
      case 'horn':
        if (!this.cooldown('horn', s.t, 1.2)) return [];
        return s.clock.isQuietTime
          ? [{ id: 'horn_quiet', detail: s.clock.quietLabel() }]
          : [{ id: 'horn' }];
      case 'exitCar': {
        const tx = Math.floor(e.x / TILE);
        const ty = Math.floor(e.y / TILE);
        const t = m.typeAt(tx, ty);
        if (t !== T.PARKING) {
          const where =
            t === T.ROAD ? 'on the carriageway' : t === T.SIDEWALK ? 'on the sidewalk' : t === T.LOT ? 'in the lot aisle' : 'somewhere creative';
          return [{ id: 'wrong_parking', detail: `Car left ${where}` }];
        }
        return e.disc ? [] : [{ id: 'no_disc' }];
      }
      case 'collision': {
        if (e.speedKmh < (e.with === 'ped' ? 1 : 5)) return [];
        if (!this.cooldown(`col_${e.with}`, s.t, 1.5)) return [];
        const id: OffenceId =
          e.with === 'car' ? 'collision_car' : e.with === 'ped' ? 'ped_hit' : 'property_damage';
        return [{ id, detail: `Impact at ${Math.round(e.speedKmh)} km/h` }];
      }
      case 'hitByCar':
        return this.cooldown('hit', s.t, 3) ? [{ id: 'obstruct_traffic' }] : [];
      case 'theft':
        return this.cooldown('theft', s.t, 2) ? [{ id: 'car_theft' }] : [];
    }
  }

  /**
   * Witnesses: Blitzer photos for speeding near a camera, and Rentner who
   * report anything they see from their window.
   */
  witnesses(
    viol: Violation[],
    px: number,
    py: number,
    t: number,
  ): { extra: Violation[]; flash: boolean; rentner: RentnerDef | null } {
    const extra: Violation[] = [];
    let flash = false;
    let rentner: RentnerDef | null = null;
    if (!viol.length) return { extra, flash, rentner };
    const speeding = viol.some((v) => v.id.startsWith('speed_') || v.id === 'tolerance_fee');
    if (speeding) {
      const near = this.map.blitzers.find((b) => Math.hypot((b.x + 0.5) * TILE - px, (b.y + 0.5) * TILE - py) < TILE * 4);
      if (near && this.witnessCooldown(`b${near.x},${near.y}`, t, 3)) {
        flash = true;
        extra.push({ id: 'photo_fee' });
      }
    }
    const reportable = viol.find((v) => !NOT_WITNESSED.has(v.id));
    if (reportable) {
      for (const r of this.map.rentner) {
        if (Math.hypot((r.x + 0.5) * TILE - px, (r.y + 0.5) * TILE - py) > TILE * 7) continue;
        if (!this.witnessCooldown(`r${r.x},${r.y}`, t, 12)) continue;
        rentner = r;
        extra.push({ id: 'anzeige', detail: `Reported by ${r.name} (window, 2nd floor)` });
        break;
      }
    }
    return { extra, flash, rentner };
  }

  private witnessCooldown(key: string, t: number, cd: number): boolean {
    const last = this.witnessCd.get(key) ?? -Infinity;
    if (t - last < cd) return false;
    this.witnessCd.set(key, t);
    return true;
  }

  private cooldown(key: string, t: number, cd: number): boolean {
    const last = this.cooldowns.get(key) ?? -Infinity;
    if (t - last < cd) return false;
    this.cooldowns.set(key, t);
    return true;
  }

  /**
   * Continuous offence helper: fires once `cond` has held for `delay` seconds,
   * then at most every `repeat` seconds.
   */
  private cont(key: string, cond: boolean, dt: number, delay: number, repeat: number): boolean {
    let st = this.timers.get(key);
    if (!st) {
      st = { acc: 0, since: Infinity };
      this.timers.set(key, st);
    }
    st.since += dt;
    if (!cond) {
      st.acc = 0;
      return false;
    }
    st.acc += dt;
    if (st.acc >= delay && st.since >= repeat) {
      st.since = 0;
      return true;
    }
    return false;
  }
}
