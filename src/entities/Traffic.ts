/** NPC road traffic. NPCs obey lights (mostly) and are never, ever fined. */
import Phaser from 'phaser';
import { TILE, toKmh, toPxs } from '../config';
import type { MapData } from '../world/MapData';
import { chooseExit, exitsFor, type Waypoint } from '../world/routing';
import { lampFor, lightAt } from '../world/TrafficLights';
import { ANGLE, BIT, VEC, Z, ZONE_LIMIT, axisOf, normAngle, type Card } from '../world/types';
import { NPC_CAR_COLORS } from '../scenes/BootScene';

export type NpcKind = 'car' | 'truck' | 'police' | 'ordnungsamt';

export class NpcCar {
  readonly sprite: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  heading = 0;
  speed = 0;
  card: Card = 'E';
  tx = 0;
  ty = 0;
  queue: Waypoint[] = [];
  factor = 1;
  raser = false;
  permitted = -1;
  stoppedAt = -1;
  stopWait = 0;
  gateWait = 0;
  stuck = 0;
  ghost = 0;
  stun = 0;
  dead = false;
  honkCd = 0;
  half: number;
  blockedByPlayer = false;

  constructor(
    scene: Phaser.Scene,
    readonly id: number,
    readonly kind: NpcKind,
  ) {
    const key =
      kind === 'truck'
        ? 'truck'
        : kind === 'police'
          ? 'police'
          : kind === 'ordnungsamt'
            ? 'ordnungsamt'
            : `car_${id % NPC_CAR_COLORS.length}`;
    this.sprite = scene.add.image(0, 0, key).setDepth(kind === 'truck' ? 21 : 20);
    this.half = kind === 'truck' ? 24 : 15;
  }

  get vx(): number {
    return Math.cos(this.heading) * this.speed;
  }
  get vy(): number {
    return Math.sin(this.heading) * this.speed;
  }
}

export interface Obstacle {
  x: number;
  y: number;
  half: number;
  isPlayer?: boolean;
  heading?: number;
}

export interface TrafficEvent {
  type: 'honk';
  x: number;
  y: number;
}

export class Ambulance {
  readonly sprite: Phaser.GameObjects.Image;
  readonly glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy = 0;
  readonly heading = 0;
  t = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = toPxs(175);
    this.sprite = scene.add.image(x, y, 'ambulance').setDepth(24);
    this.glow = scene.add.image(x, y, 'blue_glow').setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
  }
  update(dt: number): void {
    this.t += dt;
    this.x += this.vx * dt;
    this.sprite.setPosition(this.x, this.y);
    const on = Math.floor(this.t * 6) % 2 === 0;
    this.glow.setPosition(this.x + (on ? 4 : -4), this.y).setAlpha(on ? 1 : 0.4);
  }
  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
  }
}

export class Traffic {
  readonly cars: NpcCar[] = [];
  ambulance: Ambulance | null = null;
  events: TrafficEvent[] = [];
  private nextId = 1;
  private respawnT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapData,
    private readonly count = 36,
  ) {}

  spawnInitial(px: number, py: number): void {
    for (let k = 0; k < this.count; k++) this.spawnOne(px, py, 200, 1600);
  }

  clear(): void {
    this.cars.forEach((c) => c.sprite.destroy());
    this.cars.length = 0;
    this.ambulance?.destroy();
    this.ambulance = null;
  }

  spawnAmbulance(px: number): void {
    this.ambulance?.destroy();
    this.ambulance = new Ambulance(this.scene, Math.max(14 * TILE, px - 38 * TILE), 7 * TILE);
  }

  private spawnOne(px: number, py: number, minD: number, maxD: number): void {
    const m = this.map;
    for (let tries = 0; tries < 40; tries++) {
      const i = m.spawnLanes[Math.floor(Math.random() * m.spawnLanes.length)];
      const tx = i % m.w;
      const ty = Math.floor(i / m.w);
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      const d = Math.hypot(x - px, y - py);
      if (d < minD || d > maxD) continue;
      if (this.cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
      const card = m.laneCard(tx, ty);
      if (!card) continue;
      const zone = m.zone[i];
      let kind: NpcKind = 'car';
      const r = Math.random();
      if (zone === Z.AUTOBAHN) {
        const st = m.streetOf(tx, ty);
        const outer = st ? (card === 'E' || card === 'S' ? (st.axis === 'h' ? ty : tx) === st.at + st.lanes - 1 : (st.axis === 'h' ? ty : tx) === st.at) : false;
        if (outer && r < 0.6) kind = 'truck';
      } else if (r < 0.05) kind = 'police';
      else if (r < 0.1) kind = 'ordnungsamt';
      const c = new NpcCar(this.scene, this.nextId++, kind);
      c.x = x;
      c.y = y;
      c.tx = tx;
      c.ty = ty;
      c.card = card;
      c.heading = ANGLE[card];
      c.factor = 0.85 + Math.random() * 0.15;
      c.raser = kind === 'car' && Math.random() < 0.12;
      c.speed = this.cruise(c) * 0.6;
      c.sprite.setPosition(x, y).setRotation(c.heading);
      this.cars.push(c);
      return;
    }
  }

  private cruise(c: NpcCar): number {
    const m = this.map;
    const zi = m.inb(c.tx, c.ty) ? m.zone[m.idx(c.tx, c.ty)] : Z.Z50;
    let kmh = ZONE_LIMIT[zi];
    if (zi === Z.AUTOBAHN) kmh = c.kind === 'truck' ? 82 : 115 + c.factor * 30;
    else if (zi === Z.SPIEL) kmh = c.raser ? 25 : 7;
    else if (!Number.isFinite(kmh)) kmh = 50;
    else kmh = kmh * (c.raser ? 1.25 : c.factor);
    if (c.kind === 'truck') kmh = Math.min(kmh, 82);
    return toPxs(kmh);
  }

  private extend(c: NpcCar): void {
    const m = this.map;
    const last: Waypoint = c.queue.length ? c.queue[c.queue.length - 1] : { x: c.tx, y: c.ty, c: c.card };
    const [dx, dy] = VEC[last.c];
    const nx = last.x + dx;
    const ny = last.y + dy;
    if (!m.isRoad(nx, ny)) {
      c.dead = true;
      return;
    }
    const ni = m.idx(nx, ny);
    const li = m.idx(last.x, last.y);
    if (m.region[ni] >= 0 && m.region[li] < 0) {
      const is = m.intersections[m.region[ni]];
      const ex = chooseExit(exitsFor(m, is, nx, ny, last.c), last.c, Math.random());
      if (!ex) {
        c.dead = true;
        return;
      }
      ex.path.forEach((w, k) => c.queue.push({ ...w, gate: k === 0 && m.box[li] < 0 ? is.id : undefined }));
      return;
    }
    if (m.region[ni] < 0 && m.dir[ni] && !(m.dir[ni] & BIT[last.c])) {
      c.dead = true;
      return;
    }
    const w: Waypoint = { x: nx, y: ny, c: last.c };
    if (m.box[ni] >= 0 && m.box[li] < 0) w.gate = m.box[ni];
    c.queue.push(w);
  }

  update(dt: number, t: number, obstacles: Obstacle[], player: { x: number; y: number }): void {
    this.events = [];
    const m = this.map;
    const all: Obstacle[] = [...obstacles];
    for (const c of this.cars) all.push({ x: c.x, y: c.y, half: c.half, heading: c.heading });

    for (const c of this.cars) {
      c.honkCd -= dt;
      if (c.stun > 0) {
        c.stun -= dt;
        c.speed = 0;
        continue;
      }
      let guard = 0;
      while (c.queue.length < 5 && !c.dead && guard++ < 8) this.extend(c);
      if (c.dead || !c.queue.length) {
        c.dead = true;
        continue;
      }

      let target = this.cruise(c);
      if (c.queue.slice(0, 2).some((w) => w.c !== c.card)) target = Math.min(target, toPxs(16));

      // Junction gate.
      const gi = c.queue.findIndex((w, k) => k < 3 && w.gate !== undefined && w.gate !== c.permitted);
      if (gi >= 0) {
        const g = c.queue[gi];
        const [fx, fy] = VEC[g.c];
        const gx = g.x * TILE + TILE / 2;
        const gy = g.y * TILE + TILE / 2;
        const dist = (gx - c.x) * fx + (gy - c.y) * fy - TILE / 2 - c.half + 4;
        if (this.allowed(c, g, dist, t, dt)) {
          c.permitted = g.gate!;
          c.gateWait = 0;
        } else {
          c.gateWait += dt;
          target = Math.min(target, Math.sqrt(2 * 260 * Math.max(0, dist - 1)));
          if (dist < 2) target = 0;
        }
        const is = m.intersections[g.gate!];
        if (is.control === 'rvl' && dist < 50) target = Math.min(target, toPxs(22));
      }

      // Follow the vehicle in front.
      const fx = Math.cos(c.heading);
      const fy = Math.sin(c.heading);
      let gap = Infinity;
      let gapIsPlayer = false;
      for (const o of all) {
        if (o.x === c.x && o.y === c.y) continue;
        if (c.ghost > 0 && !o.isPlayer) continue;
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        const along = dx * fx + dy * fy;
        if (along <= 0 || along > 120) continue;
        const lat = Math.abs(dx * fy - dy * fx);
        if (lat > 13) continue;
        // Ignore oncoming traffic on the other side of a narrow junction.
        if (o.heading !== undefined && Math.abs(normAngle(o.heading - c.heading)) > 2.6 && lat > 8) continue;
        const g = along - c.half - o.half;
        if (g < gap) {
          gap = g;
          gapIsPlayer = !!o.isPlayer;
        }
      }
      if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 5) * 3.2));
      c.blockedByPlayer = gapIsPlayer && gap < 40;

      // Speed control.
      if (c.speed < target) c.speed = Math.min(target, c.speed + 130 * dt);
      else c.speed = Math.max(target, c.speed - 340 * dt);

      // Stuck detection.
      if (c.speed < 4 && target < 6) {
        c.stuck += dt;
        const atRed = gi >= 0 && c.gateWait > 0 && m.intersections[c.queue[gi].gate!].control === 'light';
        if (c.stuck > 7 && !atRed && !gapIsPlayer) {
          c.ghost = 2.5;
          c.stuck = 0;
        }
        if (c.blockedByPlayer && c.stuck > 3.5 && c.honkCd <= 0) {
          c.honkCd = 6;
          this.events.push({ type: 'honk', x: c.x, y: c.y });
        }
        if (c.gateWait > 9) c.permitted = c.queue[gi >= 0 ? gi : 0].gate ?? -1;
      } else c.stuck = 0;
      c.ghost = Math.max(0, c.ghost - dt);

      // Move along the waypoint queue.
      let rem = c.speed * dt;
      let desired = c.heading;
      while (c.queue.length) {
        const w = c.queue[0];
        const wx = w.x * TILE + TILE / 2;
        const wy = w.y * TILE + TILE / 2;
        const d = Math.hypot(wx - c.x, wy - c.y);
        if (d > 0.5) desired = Math.atan2(wy - c.y, wx - c.x);
        if (d <= rem) {
          c.x = wx;
          c.y = wy;
          rem -= d;
          c.queue.shift();
          c.card = w.c;
          c.tx = w.x;
          c.ty = w.y;
          if (m.box[m.idx(w.x, w.y)] < 0) {
            c.permitted = -1;
            c.stoppedAt = -1;
            c.stopWait = 0;
          }
          if (rem <= 0) break;
          continue;
        }
        if (rem > 0) {
          c.x += ((wx - c.x) / d) * rem;
          c.y += ((wy - c.y) / d) * rem;
        }
        break;
      }
      c.heading += normAngle(desired - c.heading) * Math.min(1, dt * 9);
      c.sprite.setPosition(c.x, c.y).setRotation(c.heading);
    }

    // Ambulance.
    if (this.ambulance) {
      this.ambulance.update(dt);
      if (this.ambulance.x > player.x + 45 * TILE || this.ambulance.x > 188 * TILE) {
        this.ambulance.destroy();
        this.ambulance = null;
      }
    }

    // Respawn dead or far-away cars close to the player (outside the view).
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 0.4;
      for (let k = this.cars.length - 1; k >= 0; k--) {
        const c = this.cars[k];
        const far = Math.hypot(c.x - player.x, c.y - player.y) > 2100;
        if (c.dead || far) {
          c.sprite.destroy();
          this.cars.splice(k, 1);
        }
      }
      let n = 0;
      while (this.cars.length < this.count && n++ < 4) this.spawnOne(player.x, player.y, 800, 1700);
    }
  }

  private allowed(c: NpcCar, g: Waypoint, dist: number, t: number, dt: number): boolean {
    const is = this.map.intersections[g.gate!];
    const ax = axisOf(g.c);
    switch (is.control) {
      case 'curve':
        return true;
      case 'light': {
        const lamp = lampFor(lightAt(t, is.offset), ax);
        if (lamp === 'green') return this.junctionClear(c, is.id, ax);
        if (lamp === 'amber') return dist < 10;
        return false;
      }
      case 'stop':
        if (is.stopAxis === ax && c.stoppedAt !== is.id) {
          if (dist < 8 && toKmh(c.speed) < 1.5) {
            c.stopWait += dt;
            if (c.stopWait > 0.9) c.stoppedAt = is.id;
          }
          return false;
        }
        return this.junctionClear(c, is.id, ax);
      default:
        return this.junctionClear(c, is.id, ax) || c.gateWait > 4;
    }
  }

  /** Nobody crossing on the other axis inside the junction. */
  private junctionClear(c: NpcCar, isectId: number, ax: 'h' | 'v'): boolean {
    if (c.gateWait > 6) return true;
    const is = this.map.intersections[isectId];
    const x0 = is.x0 * TILE - 6;
    const x1 = (is.x1 + 1) * TILE + 6;
    const y0 = is.y0 * TILE - 6;
    const y1 = (is.y1 + 1) * TILE + 6;
    for (const o of this.cars) {
      if (o === c || o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      if (axisOf(o.card) !== ax) return false;
    }
    return true;
  }
}
