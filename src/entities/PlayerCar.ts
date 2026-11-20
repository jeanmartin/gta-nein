/** The player's beige Kombi: simple kinematic top-down car with tile collisions. */
import Phaser from 'phaser';
import { BRAKE_FLUID_PER_SEC, TILE, toKmh, toPxs } from '../config';
import type { MapData } from '../world/MapData';
import { T } from '../world/types';

export interface CarInput {
  throttle: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface WallHit {
  speedKmh: number;
  object: boolean;
}

const HALF_L = 14;
const HALF_W = 7.5;
const MAX_F = toPxs(190);
const MAX_R = toPxs(22);
const ACCEL = 150;
const BRAKE = 420;
const HANDBRAKE = 560;

export class PlayerCar {
  readonly sprite: Phaser.GameObjects.Image;
  readonly blinkL: Phaser.GameObjects.Rectangle[];
  readonly blinkR: Phaser.GameObjects.Rectangle[];
  readonly brakeLights: Phaser.GameObjects.Rectangle[];
  x = 0;
  y = 0;
  heading = 0;
  /** Signed speed in px/s (negative = reversing). */
  speed = 0;
  belt = false;
  lights = false;
  disc = false;
  blinker: -1 | 0 | 1 = 0;
  braking = 0;
  occupied = true;
  private blinkT = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly map: MapData,
  ) {
    this.sprite = scene.add.image(0, 0, 'car_player').setDepth(22);
    const mk = (col: number) => scene.add.rectangle(0, 0, 3, 3, col).setDepth(23).setVisible(false);
    this.blinkL = [mk(0xffa500), mk(0xffa500)];
    this.blinkR = [mk(0xffa500), mk(0xffa500)];
    this.brakeLights = [mk(0xff2020), mk(0xff2020)];
  }

  get speedKmh(): number {
    return toKmh(this.speed);
  }
  get vx(): number {
    return Math.cos(this.heading) * this.speed;
  }
  get vy(): number {
    return Math.sin(this.heading) * this.speed;
  }

  place(x: number, y: number, heading: number): void {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
    this.blinker = 0;
    this.sync(0);
  }

  /** True when the car's centre is on a marked bay and the car is (almost) still. */
  get inBay(): boolean {
    return this.map.typeAt(Math.floor(this.x / TILE), Math.floor(this.y / TILE)) === T.PARKING && Math.abs(this.speedKmh) < 1;
  }

  /** Returns a wall hit when the car bumped into something solid. */
  update(dt: number, inp: CarInput): WallHit | null {
    let braking = 0;
    const s = this.speed;
    if (this.occupied) {
      if (inp.throttle) {
        if (s >= -1) this.speed += ACCEL * (1 - Math.max(0, s) / MAX_F) * dt;
        else {
          this.speed = Math.min(0, s + BRAKE * dt);
          braking = 1;
        }
      } else if (inp.reverse) {
        if (s > 1) {
          this.speed = Math.max(0, s - BRAKE * dt);
          braking = 1;
        } else this.speed = Math.max(-MAX_R, s - 90 * dt);
      }
      if (inp.handbrake) {
        braking = 1;
        this.speed = s > 0 ? Math.max(0, this.speed - HANDBRAKE * dt) : Math.min(0, this.speed + HANDBRAKE * dt);
      }
    }
    if (!(this.occupied && (inp.throttle || inp.reverse))) {
      const drag = (28 + Math.abs(this.speed) * 0.12) * dt;
      this.speed = this.speed > 0 ? Math.max(0, this.speed - drag) : Math.min(0, this.speed + drag);
    }
    if (Math.abs(this.speed) < 0.5 && !(inp.throttle || inp.reverse)) this.speed = 0;
    this.braking = braking && Math.abs(s) > 1 ? 1 : 0;

    // Steering.
    const steer = this.occupied ? (inp.left ? -1 : 0) + (inp.right ? 1 : 0) : 0;
    const absV = Math.abs(this.speed);
    const rate = (2.6 * Math.min(1, absV / 70)) / (1 + absV / 650);
    const newHeading = this.heading + steer * rate * dt * Math.sign(this.speed);

    // Move with collision.
    let hit: WallHit | null = null;
    if (newHeading !== this.heading && this.blocked(this.x, this.y, newHeading) === 0) this.heading = newHeading;
    const nx = this.x + Math.cos(this.heading) * this.speed * dt;
    const ny = this.y + Math.sin(this.heading) * this.speed * dt;
    const full = this.blocked(nx, ny, this.heading);
    if (full === 0) {
      this.x = nx;
      this.y = ny;
    } else {
      const impact = Math.abs(this.speedKmh);
      const ox = this.blocked(nx, this.y, this.heading) === 0;
      const oy = this.blocked(this.x, ny, this.heading) === 0;
      if (ox && Math.abs(nx - this.x) > Math.abs(ny - this.y) * 0.5) {
        this.x = nx;
        this.speed *= 0.8;
        if (impact > 25) hit = { speedKmh: impact * 0.3, object: full === 2 };
      } else if (oy && Math.abs(ny - this.y) > Math.abs(nx - this.x) * 0.5) {
        this.y = ny;
        this.speed *= 0.8;
        if (impact > 25) hit = { speedKmh: impact * 0.3, object: full === 2 };
      } else {
        this.speed *= -0.25;
        hit = { speedKmh: impact, object: full === 2 };
      }
    }
    this.sync(dt);
    return hit;
  }

  /** 0 = free, 1 = building/wall, 2 = object (container, fountain…) */
  blocked(x: number, y: number, h: number): number {
    const c = Math.cos(h);
    const s = Math.sin(h);
    const pts: [number, number][] = [
      [HALF_L, HALF_W],
      [HALF_L, -HALF_W],
      [-HALF_L, HALF_W],
      [-HALF_L, -HALF_W],
      [0, HALF_W],
      [0, -HALF_W],
      [HALF_L, 0],
      [-HALF_L, 0],
    ];
    for (const [a, b] of pts) {
      const px = x + a * c - b * s;
      const py = y + a * s + b * c;
      if (this.map.isSolidPx(px, py)) {
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        return this.map.typeAt(tx, ty) === T.BUILDING ? 1 : 2;
      }
    }
    return 0;
  }

  /** Corner points (for collisions with other cars). */
  circles(): [number, number][] {
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    return [
      [this.x + c * 7, this.y + s * 7],
      [this.x - c * 7, this.y - s * 7],
    ];
  }

  sync(dt: number): void {
    this.sprite.setPosition(this.x, this.y).setRotation(this.heading);
    this.blinkT += dt;
    const on = this.blinker !== 0 && Math.floor(this.blinkT * 2.6) % 2 === 0;
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const at = (a: number, b: number): [number, number] => [this.x + a * c - b * s, this.y + a * s + b * c];
    const place = (r: Phaser.GameObjects.Rectangle, a: number, b: number, vis: boolean) => {
      const [px, py] = at(a, b);
      r.setPosition(px, py).setVisible(vis);
    };
    place(this.blinkL[0], 14, -7.5, on && this.blinker < 0);
    place(this.blinkL[1], -14, -7.5, on && this.blinker < 0);
    place(this.blinkR[0], 14, 7.5, on && this.blinker > 0);
    place(this.blinkR[1], -14, 7.5, on && this.blinker > 0);
    const br = this.braking > 0;
    place(this.brakeLights[0], -15, -5, br);
    place(this.brakeLights[1], -15, 5, br);
  }

  /** Did the blinker just toggle visually (for the tick sound)? */
  blinkPhase(): number {
    return this.blinker !== 0 ? Math.floor(this.blinkT * 2.6) % 2 : -1;
  }

  addBrakeFluid(dt: number): number {
    return this.braking ? BRAKE_FLUID_PER_SEC * dt : 0;
  }

  destroy(): void {
    this.sprite.destroy();
    [...this.blinkL, ...this.blinkR, ...this.brakeLights].forEach((r) => r.destroy());
  }
}
