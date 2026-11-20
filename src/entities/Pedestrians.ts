/** NPC pedestrians: law-abiding citizens who wait at red lights even at 3 a.m. */
import Phaser from 'phaser';
import { TILE } from '../config';
import { PED_COLORS } from '../scenes/BootScene';
import type { MapData } from '../world/MapData';
import { lightAt, pedGreen } from '../world/TrafficLights';
import { CARDS, F, VEC, opposite, type Card } from '../world/types';

export class Ped {
  readonly sprite: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  tx = 0;
  ty = 0;
  card: Card = 'E';
  target: { x: number; y: number } | null = null;
  speed: number;
  wait = 0;
  knocked = 0;
  t = Math.random() * 10;

  constructor(
    scene: Phaser.Scene,
    readonly child: boolean,
  ) {
    const key = child ? 'child' : `ped_${Math.floor(Math.random() * PED_COLORS.length)}`;
    this.sprite = scene.add.image(0, 0, key).setDepth(12);
    this.speed = child ? 48 : 30 + Math.random() * 16;
  }
}

export class Pedestrians {
  readonly peds: Ped[] = [];
  private respawnT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapData,
    private readonly count = 46,
  ) {}

  spawnInitial(px: number, py: number): void {
    for (let k = 0; k < this.count; k++) this.spawnOne(px, py, 60, 1400);
  }

  clear(): void {
    this.peds.forEach((p) => p.sprite.destroy());
    this.peds.length = 0;
  }

  private spawnOne(px: number, py: number, minD: number, maxD: number): void {
    const m = this.map;
    for (let tries = 0; tries < 30; tries++) {
      const i = m.spawnWalk[Math.floor(Math.random() * m.spawnWalk.length)];
      const tx = i % m.w;
      const ty = Math.floor(i / m.w);
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      const d = Math.hypot(x - px, y - py);
      if (d < minD || d > maxD) continue;
      const nearSchool = tx >= 36 && tx <= 57 && ty >= 64 && ty <= 70;
      const p = new Ped(this.scene, nearSchool ? Math.random() < 0.7 : Math.random() < 0.08);
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.tx = tx;
      p.ty = ty;
      p.card = CARDS[Math.floor(Math.random() * 4)];
      this.peds.push(p);
      return;
    }
  }

  update(dt: number, t: number, player: { x: number; y: number }): void {
    for (const p of this.peds) {
      p.t += dt;
      if (p.knocked > 0) {
        p.knocked -= dt;
        p.sprite.setPosition(p.x, p.y).setRotation(p.sprite.rotation + dt * 8);
        continue;
      }
      if (!p.target) this.choose(p, t);
      if (!p.target) {
        p.wait += dt;
        if (p.wait > 25) {
          p.card = opposite(p.card);
          p.wait = 0;
        }
        p.sprite.setPosition(p.x, p.y);
        continue;
      }
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step) {
        p.x = p.target.x;
        p.y = p.target.y;
        p.tx = Math.floor(p.x / TILE);
        p.ty = Math.floor(p.y / TILE);
        p.target = null;
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
      const sw = Math.sin(p.t * 12) * 0.08;
      p.sprite.setPosition(p.x, p.y).setRotation(Math.atan2(dy, dx)).setScale(1 + sw, 1 - sw);
    }

    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 0.5;
      for (let k = this.peds.length - 1; k >= 0; k--) {
        const p = this.peds[k];
        if (Math.hypot(p.x - player.x, p.y - player.y) > 1900) {
          p.sprite.destroy();
          this.peds.splice(k, 1);
        }
      }
      let n = 0;
      while (this.peds.length < this.count && n++ < 4) this.spawnOne(player.x, player.y, 700, 1500);
    }
  }

  private choose(p: Ped, t: number): void {
    const m = this.map;
    const here = m.inb(p.tx, p.ty) ? m.idx(p.tx, p.ty) : -1;
    const onCross = here >= 0 && (m.flags[here] & F.CROSSWALK) !== 0;
    const ok = (c: Card): boolean => {
      const nx = p.tx + VEC[c][0];
      const ny = p.ty + VEC[c][1];
      if (!m.pedWalkable(nx, ny)) return false;
      const ni = m.idx(nx, ny);
      if (m.flags[ni] & F.CROSSWALK && !onCross && m.box[ni] >= 0) {
        const is = m.intersections[m.box[ni]];
        if (!pedGreen(lightAt(t, is.offset), m.crossAxis[ni] === 1 ? 'h' : 'v')) return false;
      }
      return true;
    };
    let next: Card | null = null;
    if (onCross) next = ok(p.card) ? p.card : null;
    else {
      const opts = CARDS.filter((c) => c !== opposite(p.card) && ok(c));
      const aheadX = p.tx + VEC[p.card][0];
      const aheadY = p.ty + VEC[p.card][1];
      // Red Ampelmännchen ahead: most citizens wait, even with no car in sight.
      if (!ok(p.card) && m.pedWalkable(aheadX, aheadY) && p.wait < 20 && Math.random() < 0.97) return;
      if (opts.includes(p.card) && Math.random() < 0.8) next = p.card;
      else if (opts.length) next = opts[Math.floor(Math.random() * opts.length)];
      else {
        // Maybe the way ahead is a red light: wait patiently (like a good citizen).
        const ahead = p.tx + VEC[p.card][0];
        const aheadY = p.ty + VEC[p.card][1];
        if (m.pedWalkable(ahead, aheadY)) return;
        if (ok(opposite(p.card))) next = opposite(p.card);
      }
    }
    if (!next) return;
    p.card = next;
    p.wait = 0;
    const nx = p.tx + VEC[next][0];
    const ny = p.ty + VEC[next][1];
    const jitter = () => (Math.random() - 0.5) * 12;
    p.target = { x: nx * TILE + TILE / 2 + (next === 'N' || next === 'S' ? jitter() * 0.5 : 0), y: ny * TILE + TILE / 2 + (next === 'E' || next === 'W' ? jitter() * 0.5 : 0) };
  }
}
