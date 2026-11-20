/** The player on foot: 8-directional walking with tile collisions. */
import Phaser from 'phaser';
import type { MapData } from '../world/MapData';

export class PlayerFoot {
  readonly sprite: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  heading = 0;
  /** Recent positions, used by the dog to follow. */
  readonly trail: { x: number; y: number }[] = [];
  private walkT = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly map: MapData,
  ) {
    this.sprite = scene.add.image(0, 0, 'player_foot').setDepth(21).setVisible(false);
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.trail.length = 0;
    this.sync(0);
  }

  update(dt: number, dx: number, dy: number, run: boolean): void {
    const len = Math.hypot(dx, dy);
    const sp = run ? 125 : 72;
    this.vx = len ? (dx / len) * sp : 0;
    this.vy = len ? (dy / len) * sp : 0;
    if (len) this.heading = Math.atan2(this.vy, this.vx);
    const r = 5;
    const free = (x: number, y: number) =>
      !this.map.isSolidPx(x - r, y - r) &&
      !this.map.isSolidPx(x + r, y - r) &&
      !this.map.isSolidPx(x - r, y + r) &&
      !this.map.isSolidPx(x + r, y + r);
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (free(nx, this.y)) this.x = nx;
    else this.vx = 0;
    if (free(this.x, ny)) this.y = ny;
    else this.vy = 0;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 3) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 60) this.trail.shift();
    }
    if (len) this.walkT += dt;
    this.sync(dt);
  }

  sync(_dt: number): void {
    const bob = Math.sin(this.walkT * 14) * 0.08;
    this.sprite.setPosition(this.x, this.y).setRotation(this.heading).setScale(1 + bob, 1 - bob);
  }

  /** Push the player (e.g. when hit by a car). */
  knock(dx: number, dy: number): void {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!this.map.isSolidPx(nx, ny)) {
      this.x = nx;
      this.y = ny;
    }
  }
}
