import Phaser from 'phaser';
import { TILE, toKmh } from '../config';
import { PlayerCar, type CarInput } from '../entities/PlayerCar';
import { PlayerFoot } from '../entities/PlayerFoot';
import { Pedestrians } from '../entities/Pedestrians';
import { Traffic, type Obstacle } from '../entities/Traffic';
import { MISSIONS } from '../missions';
import { MissionManager } from '../missions/MissionManager';
import type { Area, MissionCmd, MissionSnap } from '../missions/types';
import { RuleEngine, type Snapshot, type Violation } from '../rules/RuleEngine';
import { Bureaucracy, type BureauState } from '../systems/Bureaucracy';
import { Clock } from '../systems/Clock';
import { Sfx } from '../systems/Sfx';
import { Decor } from '../world/Decor';
import { buildMap, type MapData } from '../world/MapData';
import { MapRenderer } from '../world/MapRenderer';
import { F, T, Z, ZONE_LIMIT, ZONE_NAME } from '../world/types';
import type { UIScene } from './UIScene';

export interface HudState {
  mode: 'car' | 'foot';
  speed: number;
  limit: number;
  zoneName: string;
  street: string;
  money: number;
  points: number;
  clock: string;
  quiet: string;
  blinker: -1 | 0 | 1;
  blinkOn: boolean;
  belt: boolean;
  lights: boolean;
  disc: boolean;
  missionTitle: string;
  missionNo: number;
  objective: string;
  rescueLane: boolean | null;
  pedLight: 'red' | 'green' | null;
  waiting: boolean;
  px: number;
  py: number;
  carX: number;
  carY: number;
  target: Area | null;
  night: boolean;
  autobahn: boolean;
}

export interface GameStats {
  fineCount: number;
  finesTotal: number;
  points: number;
  brakeFluidL: number;
  taxesPaid: number;
  money: number;
}

const SAVE_KEY = 'gtanein.save.v1';
/** Size of the night layer; covers the view at the minimum camera zoom (0.85). */
const DARK_W = 1600;
const DARK_H = 960;

export function loadSave(): { mission: number; bureau: BureauState } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

interface Dog {
  sprite: Phaser.GameObjects.Image;
  leash: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  map!: MapData;
  private mapRenderer!: MapRenderer;
  private decor!: Decor;
  car!: PlayerCar;
  foot!: PlayerFoot;
  mode: 'car' | 'foot' = 'car';
  traffic!: Traffic;
  peds!: Pedestrians;
  readonly clock = new Clock();
  bureau = new Bureaucracy();
  rules!: RuleEngine;
  missions!: MissionManager;
  ui!: UIScene;
  t = 0;
  debug = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private camTarget!: Phaser.GameObjects.Zone;
  /** Night: a darkness layer that lights are erased out of. */
  private dark!: Phaser.GameObjects.RenderTexture;
  private eraseBeam!: Phaser.GameObjects.Image;
  private eraseGlow!: Phaser.GameObjects.Image;
  private headlight!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Graphics;
  private arrow!: Phaser.GameObjects.Image;
  private dog: Dog | null = null;
  private poops = new Map<number, Phaser.GameObjects.Image>();
  private interact = false;
  private frozen = false;
  private lastNein = -10;
  private lastBlinkPhase = -1;
  private debugText?: Phaser.GameObjects.Text;
  private startIndex = 0;
  private restore: BureauState | null = null;
  private hintCount = 0;

  constructor() {
    super('Game');
  }

  init(data: { mission?: number; restore?: BureauState | null }): void {
    this.startIndex = data.mission ?? 0;
    this.restore = data.restore ?? null;
    this.mode = 'car';
    this.frozen = false;
    this.t = 0;
    this.dog = null;
    this.poops = new Map();
    this.bureau = new Bureaucracy();
    this.debug = new URLSearchParams(location.search).has('debug');
  }

  create(): void {
    this.map = (this.registry.get('map') as MapData | undefined) ?? buildMap();
    this.registry.set('map', this.map);
    if (this.restore) this.bureau.restore(this.restore);

    this.mapRenderer = new MapRenderer(this, this.map);
    MapRenderer.drawMinimap(this, this.map, 'minimap');
    this.decor = new Decor(this, this.map);
    this.car = new PlayerCar(this, this.map);
    this.foot = new PlayerFoot(this, this.map);
    this.traffic = new Traffic(this, this.map);
    this.peds = new Pedestrians(this, this.map);
    this.rules = new RuleEngine(this.map);

    this.dark = this.add.renderTexture(0, 0, DARK_W, DARK_H).setOrigin(0.5).setDepth(50).setVisible(false);
    this.eraseBeam = this.make.image({ key: 'headlight', add: false }).setOrigin(0, 0.5);
    this.eraseGlow = this.make.image({ key: 'glow', add: false });
    this.headlight = this.add.image(0, 0, 'headlight').setOrigin(0, 0.5).setDepth(51).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.marker = this.add.graphics().setDepth(40);
    this.arrow = this.add.image(0, 0, 'arrow').setDepth(41).setVisible(false);

    const cam = this.cameras.main;
    // Generous bounds so the HUD never hides roads at the map edge; the outside is countryside.
    cam.setBounds(-480, -480, this.map.w * TILE + 960, this.map.h * TILE + 960);
    cam.setBackgroundColor('#79a64e');
    this.camTarget = this.add.zone(0, 0, 1, 1);
    cam.startFollow(this.camTarget, false, 0.12, 0.12);
    cam.setZoom(1.6);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,Z') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown-B', () => this.onKey('B'));
    kb.on('keydown-Q', () => this.onKey('Q'));
    kb.on('keydown-E', () => this.onKey('E'));
    kb.on('keydown-L', () => this.onKey('L'));
    kb.on('keydown-H', () => this.onKey('H'));
    kb.on('keydown-P', () => this.onKey('P'));
    kb.on('keydown-F', () => this.onKey('F'));
    kb.on('keydown-SPACE', () => this.onKey('SPACE'));
    kb.on('keydown-M', () => this.ui?.toast(Sfx.toggleMute() ? 'Sound off (M)' : 'Sound on (M)'));
    kb.on('keydown-ESC', () => this.onKey('ESC'));
    if (this.debug) {
      kb.on('keydown-N', () => this.missions.advance());
      kb.on('keydown-K', () => (this.bureau.money += 1000));
      kb.on('keydown-T', () => this.debugTeleport());
      this.debugText = this.add
        .text(8, 700, '', { fontFamily: 'monospace', fontSize: '11px', color: '#0f0', backgroundColor: '#000a' })
        .setScrollFactor(0)
        .setDepth(100);
    }

    this.missions = new MissionManager(MISSIONS, this.clock, this.bureau, {
      letters: (letters, done) => this.ui.showLetters(letters, done),
      command: (c) => this.command(c),
      ending: () => this.startEnding(),
      started: (index) => {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify({ mission: index, bureau: this.bureau.state() }));
        } catch {
          /* private mode */
        }
      },
    });

    this.scene.launch('UI', { game: this });
    this.ui = this.scene.get('UI') as UIScene;
    // Start once the UI scene is ready to show the first letter.
    this.ui.events.once('ui-ready', () => this.missions.start(this.startIndex));
    this.events.once('shutdown', () => {
      Sfx.stopAll();
      this.mapRenderer.destroy();
    });
  }

  // ───────────────────────────── input ─────────────────────────────
  private onKey(k: string): void {
    if (this.frozen || !this.ui || this.ui.letterOpen) return;
    if (k === 'ESC') {
      this.ui.togglePause();
      return;
    }
    if (this.ui.paused) return;
    const inCar = this.mode === 'car';
    switch (k) {
      case 'B':
        if (!inCar) return;
        this.car.belt = !this.car.belt;
        this.ui.toast(this.car.belt ? 'Seatbelt fastened ✔ (angeschnallt)' : 'Seatbelt unfastened');
        Sfx.blinker(true);
        break;
      case 'Q':
      case 'E': {
        if (!inCar) return;
        const d = k === 'Q' ? -1 : 1;
        this.car.blinker = this.car.blinker === d ? 0 : d;
        Sfx.blinker(this.car.blinker !== 0);
        break;
      }
      case 'L':
        if (!inCar) return;
        this.car.lights = !this.car.lights;
        this.ui.toast(this.car.lights ? 'Headlights on' : 'Headlights off');
        break;
      case 'H':
        if (!inCar) return;
        Sfx.horn();
        this.bureau.charge(0.5);
        this.issue(
          this.rules.onEvent({ type: 'horn' }, this.snapshot()).map((v) => ({ ...v, detail: `${v.detail ? v.detail + ' · ' : ''}plus €0,50 Hupensteuer (horn tax)` })),
        );
        break;
      case 'P':
        if (!inCar) return;
        if (Math.abs(this.car.speedKmh) > 2) {
          this.ui.toast('Setting the Parkscheibe while driving? NEIN.');
          return;
        }
        this.car.disc = !this.car.disc;
        if (this.car.disc) {
          const m = Math.ceil(this.clock.minutes / 30) * 30;
          this.ui.toast(`Parkscheibe set to ${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} (rounded up to the next half hour, as required)`);
        } else this.ui.toast('Parkscheibe removed');
        break;
      case 'F':
        this.toggleCar();
        break;
      case 'SPACE':
        if (!inCar) this.interact = true;
        break;
    }
  }

  private toggleCar(): void {
    if (this.mode === 'car') {
      if (Math.abs(this.car.speedKmh) > 3) {
        this.ui.toast('Stop the car first. Completely. 0,0 km/h.');
        return;
      }
      const c = Math.cos(this.car.heading);
      const s = Math.sin(this.car.heading);
      const opts: [number, number][] = [
        [0, -20],
        [0, 20],
        [-26, 0],
        [26, 0],
      ];
      let pos: [number, number] | null = null;
      for (const [a, b] of opts) {
        const x = this.car.x + a * c - b * s;
        const y = this.car.y + a * s + b * c;
        if (!this.map.isSolidPx(x, y)) {
          pos = [x, y];
          break;
        }
      }
      if (!pos) {
        this.ui.toast('You cannot open the door here.');
        return;
      }
      this.issue(this.rules.onEvent({ type: 'exitCar', x: this.car.x, y: this.car.y, disc: this.car.disc }, this.snapshot()));
      this.mode = 'foot';
      this.car.occupied = false;
      this.car.blinker = 0;
      this.foot.place(pos[0], pos[1]);
      this.foot.sprite.setVisible(true);
      Sfx.typewriter();
    } else {
      const d = Math.hypot(this.foot.x - this.car.x, this.foot.y - this.car.y);
      if (d < 36) {
        this.mode = 'car';
        this.car.occupied = true;
        this.car.belt = false;
        this.foot.sprite.setVisible(false);
        Sfx.typewriter();
        if (this.hintCount++ < 3) this.ui.toast('Anschnallen nicht vergessen! Press B before driving.');
        return;
      }
      const npc = this.traffic.cars.find((c) => Math.hypot(c.x - this.foot.x, c.y - this.foot.y) < 34);
      if (npc) {
        this.bubble(npc.x, npc.y - 20, 'NEIN! Mein Auto!', '#ff4444');
        this.issue(this.rules.onEvent({ type: 'theft' }, this.snapshot()));
      } else this.ui.toast('Your car is too far away.');
    }
  }

  // ───────────────────────────── missions ─────────────────────────────
  private command(c: MissionCmd): void {
    switch (c.type) {
      case 'place': {
        this.car.place(c.car.x * TILE, c.car.y * TILE, c.car.heading);
        this.car.disc = c.disc ?? false;
        this.car.belt = false;
        this.car.lights = false;
        this.mode = c.mode;
        this.car.occupied = c.mode === 'car';
        if (c.mode === 'foot') {
          const p = c.player ?? { x: c.car.x, y: c.car.y + 1 };
          this.foot.place(p.x * TILE, p.y * TILE);
          this.foot.sprite.setVisible(true);
        } else this.foot.sprite.setVisible(false);
        this.rules.reset();
        this.traffic.clear();
        this.peds.clear();
        Sfx.setSiren(false);
        const px = this.mode === 'car' ? this.car.x : this.foot.x;
        const py = this.mode === 'car' ? this.car.y : this.foot.y;
        this.traffic.spawnInitial(px, py);
        this.peds.spawnInitial(px, py);
        this.camTarget.setPosition(px, py);
        this.cameras.main.centerOn(px, py);
        if (this.dog) this.setDog(false);
        for (const img of this.poops.values()) img.destroy();
        this.poops.clear();
        break;
      }
      case 'clock':
        this.clock.set(c.day, c.h, c.m);
        break;
      case 'toast':
        this.ui.toast(c.text);
        break;
      case 'banner':
        this.ui.banner(c.text, c.sub);
        break;
      case 'fine':
        this.issue([{ id: c.id, detail: c.detail }]);
        break;
      case 'dog':
        this.setDog(c.on);
        break;
      case 'poop':
        this.poops.set(c.id, this.add.image(c.x * TILE, c.y * TILE, 'poop').setDepth(11));
        break;
      case 'poopGone':
        this.poops.get(c.id)?.destroy();
        this.poops.delete(c.id);
        break;
      case 'ambulance':
        this.traffic.spawnAmbulance(this.car.x);
        Sfx.setSiren(true);
        break;
      case 'sfx':
        if (c.name === 'ok') Sfx.ok();
        else if (c.name === 'stamp') Sfx.stamp();
        else Sfx.fanfare();
        break;
    }
  }

  private setDog(on: boolean): void {
    if (on && !this.dog) {
      const x = this.foot.x - 20;
      const y = this.foot.y;
      this.dog = {
        sprite: this.add.image(x, y, 'dog').setDepth(13),
        leash: this.add.graphics().setDepth(13),
        x,
        y,
      };
    } else if (!on && this.dog) {
      this.dog.sprite.destroy();
      this.dog.leash.destroy();
      this.dog = null;
    }
  }

  private startEnding(): void {
    this.frozen = true;
    this.ui.banner('ABGEGEBEN!', 'Your tax return was filed on time. You have WON! …right?');
    Sfx.fanfare();
    const px = this.mode === 'car' ? this.car.x : this.foot.x;
    const py = this.mode === 'car' ? this.car.y : this.foot.y;
    this.time.delayedCall(2600, () => {
      Sfx.setSiren(true);
      const spots: [string, number, number][] = [
        ['van_black', -50, 0],
        ['police', 40, -36],
        ['police', 40, 36],
      ];
      spots.forEach(([key, dx, dy], k) => {
        const from = { x: px + (k === 0 ? -500 : 500), y: py + dy * 4 };
        const img = this.add.image(from.x, from.y, key).setDepth(24).setRotation(k === 0 ? 0 : Math.PI);
        const glow = this.add.image(from.x, from.y, 'blue_glow').setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: [img, glow], x: px + dx, y: py + dy, duration: 1800, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 160 });
      });
      this.time.delayedCall(1900, () => {
        this.cameras.main.shake(400, 0.006);
        this.bubble(px - 50, py - 30, 'STEUERFAHNDUNG! Hände hoch!', '#ffdd00');
      });
      this.time.delayedCall(4400, () => {
        this.cameras.main.fadeOut(900, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          Sfx.stopAll();
          clearSave();
          this.scene.stop('UI');
          this.scene.start('Ending', { stats: this.stats(), tax: this.bureau.brakeFluidTax() });
        });
      });
    });
  }

  stats(): GameStats {
    const b = this.bureau;
    return {
      fineCount: b.fineCount,
      finesTotal: b.finesTotal,
      points: b.points,
      brakeFluidL: b.brakeFluidL,
      taxesPaid: b.taxesPaid,
      money: b.money,
    };
  }

  restartMission(): void {
    const save = loadSave();
    if (save) this.bureau.restore(save.bureau);
    this.missions.start(this.missions.index);
  }

  // ───────────────────────────── fines ─────────────────────────────
  issue(vs: Violation[]): void {
    if (!vs.length || this.frozen) return;
    const px = this.mode === 'car' ? this.car.x : this.foot.x;
    const py = this.mode === 'car' ? this.car.y : this.foot.y;
    const wit = this.rules.witnesses(vs, px, py, this.t);
    for (const v of [...vs, ...wit.extra]) this.ui.fine(this.bureau.fine(v.id, v.detail));
    if (wit.flash) {
      this.cameras.main.flash(140, 255, 255, 255);
      Sfx.flash();
    }
    if (wit.rentner) this.bubble((wit.rentner.x + 0.5) * TILE, wit.rentner.y * TILE, 'Das melde ich!', '#ffffff');
    Sfx.stamp();
    if (this.t - this.lastNein > 1.2) {
      this.lastNein = this.t;
      this.ui.nein();
      Sfx.nein();
    }
    this.checkGameOver();
  }

  private checkGameOver(): void {
    const reason = this.bureau.licenceRevoked ? 'fuehrerschein' : this.bureau.broke ? 'pfaendung' : null;
    if (!reason || this.frozen) return;
    this.frozen = true;
    this.time.delayedCall(1600, () => {
      Sfx.stopAll();
      this.scene.stop('UI');
      this.scene.start('GameOver', { reason, stats: this.stats(), mission: this.missions.index });
    });
  }

  bubble(x: number, y: number, text: string, color = '#ffffff'): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '13px',
        color,
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 1300, duration: 900, onComplete: () => t.destroy() });
  }

  // ───────────────────────────── loop ─────────────────────────────
  snapshot(): Snapshot {
    const inCar = this.mode === 'car';
    const a = this.traffic.ambulance;
    return {
      t: this.t,
      clock: this.clock,
      player: inCar
        ? {
            mode: 'car',
            x: this.car.x,
            y: this.car.y,
            vx: this.car.vx,
            vy: this.car.vy,
            heading: this.car.heading,
            speedKmh: this.car.speedKmh,
            belt: this.car.belt,
            lights: this.car.lights,
            blinker: this.car.blinker,
          }
        : {
            mode: 'foot',
            x: this.foot.x,
            y: this.foot.y,
            vx: this.foot.vx,
            vy: this.foot.vy,
            heading: this.foot.heading,
            speedKmh: 0,
            belt: true,
            lights: true,
            blinker: 0,
          },
      npcs: this.traffic.cars,
      peds: this.peds.peds,
      ambulance: a ? { id: -1, x: a.x, y: a.y, vx: a.vx, vy: 0, heading: 0 } : null,
    };
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const cam = this.cameras.main;
    this.mapRenderer.update(cam.worldView);
    if (!this.ui || this.ui.letterOpen || this.ui.paused || this.frozen || this.missions.state === 'briefing') {
      Sfx.engine(0, false);
      if (this.frozen) this.updateVisuals(dt);
      return;
    }
    this.t += dt;

    // Clock (Z = wait, only when standing still).
    const before = this.clock.day * 1440 + this.clock.minutes;
    this.clock.waiting = this.keys.Z.isDown && (this.mode === 'foot' || Math.abs(this.car.speedKmh) < 1);
    this.clock.advance(dt);
    const gameDt = (this.clock.day * 1440 + this.clock.minutes - before + 7 * 1440) % (7 * 1440);

    const k = this.keys;
    const vio: Violation[] = [];
    const inp: CarInput = {
      throttle: k.W.isDown || k.UP.isDown,
      reverse: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown,
      right: k.D.isDown || k.RIGHT.isDown,
      handbrake: this.mode === 'car' && k.SPACE.isDown,
    };
    const snap0 = this.snapshot();
    if (this.mode === 'car') {
      const hit = this.car.update(dt, inp);
      this.bureau.brakeFluidL += this.car.addBrakeFluid(dt);
      if (hit) vio.push(...this.rules.onEvent({ type: 'collision', with: hit.object ? 'object' : 'building', speedKmh: hit.speedKmh }, snap0));
      if (Math.abs(this.car.speedKmh) > 3 && this.car.disc) this.car.disc = false;
    } else {
      const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const dy = (inp.reverse ? 1 : 0) - (inp.throttle ? 1 : 0);
      this.foot.update(dt, dx, dy, k.SHIFT.isDown);
      this.car.update(dt, { throttle: false, reverse: false, left: false, right: false, handbrake: false });
    }

    // NPCs.
    const player = this.mode === 'car' ? { x: this.car.x, y: this.car.y } : { x: this.foot.x, y: this.foot.y };
    const obstacles: Obstacle[] = [{ x: this.car.x, y: this.car.y, half: 15, isPlayer: true, heading: this.car.heading }];
    if (this.mode === 'foot' && this.onRoad(this.foot.x, this.foot.y)) obstacles.push({ x: this.foot.x, y: this.foot.y, half: 6, isPlayer: true });
    for (const p of this.peds.peds) if (this.onRoad(p.x, p.y)) obstacles.push({ x: p.x, y: p.y, half: 6 });
    this.traffic.update(dt, this.t, obstacles, player);
    this.peds.update(dt, this.t, player);
    for (const e of this.traffic.events) {
      this.bubble(e.x, e.y - 18, 'HUP! HUP!', '#ffcc00');
      if (Math.hypot(e.x - player.x, e.y - player.y) < 500) Sfx.horn();
    }
    if (!this.traffic.ambulance) Sfx.setSiren(false);
    else Sfx.sirenVolume(Math.max(0.02, 0.16 - Math.abs(this.traffic.ambulance.x - player.x) / 6000));

    this.collisions(vio, snap0);
    this.updateDog(dt);

    // Rules.
    const snap = this.snapshot();
    vio.push(...this.rules.update(snap, dt));
    if (this.rules.events.includes('turnDone')) this.car.blinker = 0;
    if (this.rules.events.includes('beltWarning')) {
      Sfx.beltChime();
      this.ui.toast('PIEP PIEP PIEP — Anschnallen! Press B now, or the Ordnungsamt will.');
    }
    this.issue(vio);

    // Missions.
    const ms: MissionSnap = {
      mode: this.mode,
      px: player.x / TILE,
      py: player.y / TILE,
      carX: this.car.x / TILE,
      carY: this.car.y / TILE,
      carSpeedKmh: this.car.speedKmh,
      carInBay: this.car.inBay,
      disc: this.car.disc,
      belt: this.car.belt,
      interact: this.interact,
      dogX: this.dog ? this.dog.x / TILE : null,
      dogY: this.dog ? this.dog.y / TILE : null,
      gameDt,
    };
    if (!this.frozen) this.missions.update(ms, dt);
    this.interact = false;

    // Sound.
    Sfx.engine(Math.abs(this.car.speedKmh), this.mode === 'car');
    const bp = this.car.blinkPhase();
    if (bp !== this.lastBlinkPhase && bp >= 0) Sfx.blinker(bp === 0);
    this.lastBlinkPhase = bp;

    this.updateVisuals(dt);
  }

  private onRoad(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return this.map.typeAt(tx, ty) === T.ROAD;
  }

  private collisions(vio: Violation[], snap: Snapshot): void {
    const car = this.car;
    // Player car vs NPC cars.
    for (const n of this.traffic.cars) {
      if (Math.abs(n.x - car.x) > 60 || Math.abs(n.y - car.y) > 60) continue;
      const nc = Math.cos(n.heading);
      const ns = Math.sin(n.heading);
      const off = n.half - 8;
      const ncs: [number, number][] = [
        [n.x + nc * off, n.y + ns * off],
        [n.x - nc * off, n.y - ns * off],
      ];
      let best: { d: number; nx: number; ny: number } | null = null;
      for (const [ax, ay] of car.circles())
        for (const [bx, by] of ncs) {
          const dx = ax - bx;
          const dy = ay - by;
          const d = Math.hypot(dx, dy);
          if (d < 16 && (!best || d < best.d)) best = { d, nx: dx / (d || 1), ny: dy / (d || 1) };
        }
      if (!best) continue;
      const depth = 16 - best.d;
      const nx = car.x + best.nx * depth;
      const ny = car.y + best.ny * depth;
      if (car.blocked(nx, ny, car.heading) === 0) {
        car.x = nx;
        car.y = ny;
      }
      const impact = Math.abs(car.speedKmh);
      const npcImpact = toKmh(n.speed);
      n.stun = 1.2;
      n.speed = 0;
      if (impact > 4 && this.mode === 'car') {
        car.speed *= -0.3;
        vio.push(...this.rules.onEvent({ type: 'collision', with: 'car', speedKmh: impact }, snap));
        this.bubble(n.x, n.y - 18, 'Mein Lack!!', '#ffffff');
      } else if (npcImpact > 5) {
        vio.push(...this.rules.onEvent({ type: 'hitByCar' }, snap));
        this.bubble(n.x, n.y - 18, 'Sie stehen im Weg!', '#ffffff');
      }
    }
    // Player car vs pedestrians.
    if (Math.abs(car.speedKmh) > 1) {
      for (const p of this.peds.peds) {
        if (p.knocked > 0) continue;
        const hit = car.circles().some(([cx, cy]) => Math.hypot(p.x - cx, p.y - cy) < 13);
        if (!hit) continue;
        p.knocked = 1.6;
        const a = Math.atan2(p.y - car.y, p.x - car.x);
        p.x += Math.cos(a) * 16;
        p.y += Math.sin(a) * 16;
        p.target = null;
        this.bubble(p.x, p.y - 14, 'AUA! Anzeige!', '#ff8080');
        vio.push(...this.rules.onEvent({ type: 'collision', with: 'ped', speedKmh: Math.abs(car.speedKmh) }, snap));
      }
    }
    // NPC cars vs the player on foot.
    if (this.mode === 'foot') {
      for (const n of this.traffic.cars) {
        if (n.speed < 20) continue;
        if (Math.hypot(n.x - this.foot.x, n.y - this.foot.y) > n.half + 4) continue;
        const a = Math.atan2(this.foot.y - n.y, this.foot.x - n.x);
        this.foot.knock(Math.cos(a) * 18, Math.sin(a) * 18);
        n.stun = 1.5;
        n.speed = 0;
        this.bubble(n.x, n.y - 18, 'HUP! Aus dem Weg!', '#ffcc00');
        vio.push(...this.rules.onEvent({ type: 'hitByCar' }, snap));
      }
    }
    // Ambulance vs player car.
    const amb = this.traffic.ambulance;
    if (amb && this.mode === 'car' && Math.hypot(amb.x - car.x, amb.y - car.y) < 18) {
      vio.push(...this.rules.onEvent({ type: 'collision', with: 'car', speedKmh: Math.max(30, Math.abs(car.speedKmh)) }, snap));
    }
  }

  private updateDog(dt: number): void {
    const d = this.dog;
    if (!d) return;
    if (this.mode === 'car') {
      d.x = this.car.x;
      d.y = this.car.y;
      d.sprite.setVisible(false);
      d.leash.clear();
      return;
    }
    d.sprite.setVisible(true);
    const tr = this.foot.trail;
    const tgt = tr.length > 8 ? tr[tr.length - 9] : { x: this.foot.x - 16, y: this.foot.y };
    const dx = tgt.x - d.x;
    const dy = tgt.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, 150 * dt);
      d.x += (dx / dist) * step;
      d.y += (dy / dist) * step;
      d.sprite.setRotation(Math.atan2(dy, dx));
    }
    d.sprite.setPosition(d.x, d.y);
    d.leash.clear().lineStyle(1.2, 0xc0392b, 0.9).lineBetween(this.foot.x, this.foot.y, d.x + Math.cos(d.sprite.rotation) * 8, d.y + Math.sin(d.sprite.rotation) * 8);
  }

  private updateVisuals(dt: number): void {
    const cam = this.cameras.main;
    const px = this.mode === 'car' ? this.car.x : this.foot.x;
    const py = this.mode === 'car' ? this.car.y : this.foot.y;
    if (!this.frozen || this.missions.state !== 'complete') this.camTarget.setPosition(px, py);
    const speed = Math.abs(this.car.speedKmh);
    const targetZoom = this.mode === 'foot' ? 1.9 : Phaser.Math.Linear(1.6, 0.85, Math.min(1, speed / 150));
    cam.setZoom(Phaser.Math.Linear(cam.zoom, targetZoom, Math.min(1, dt * 1.6)));

    const night = this.clock.isNight;
    this.updateNight(night, px, py);
    this.decor.update(this.t, night);

    // Objective marker + arrow.
    const tgt = this.missions.objective?.target ?? null;
    this.marker.clear();
    this.arrow.setVisible(false);
    if (tgt) {
      const pulse = 0.55 + Math.sin(this.time.now / 180) * 0.35;
      this.marker.lineStyle(3, 0xffd400, pulse).strokeRect(tgt.x * TILE, tgt.y * TILE, tgt.w * TILE, tgt.h * TILE);
      this.marker.fillStyle(0xffd400, 0.12 * pulse).fillRect(tgt.x * TILE, tgt.y * TILE, tgt.w * TILE, tgt.h * TILE);
      const cx = (tgt.x + tgt.w / 2) * TILE;
      const cy = (tgt.y + tgt.h / 2) * TILE;
      if (!cam.worldView.contains(cx, cy)) {
        const a = Math.atan2(cy - py, cx - px);
        const r = 70 / cam.zoom + 20;
        this.arrow.setVisible(true).setPosition(px + Math.cos(a) * r, py + Math.sin(a) * r).setRotation(a).setScale(1 / cam.zoom + 0.3);
      }
    }

    if (this.debugText) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      const i = this.map.idx(tx, ty);
      this.debugText.setText(
        `tile ${tx},${ty} type ${this.map.type[i]} zone ${this.map.zone[i]} dir ${this.map.dir[i]} box ${this.map.box[i]} flags ${this.map.flags[i]} npcs ${this.traffic.cars.length} peds ${this.peds.peds.length} fps ${Math.round(this.game.loop.actualFps)}`,
      );
    }
  }

  /**
   * Darkness with real light: fill a camera-sized layer with night blue, then erase
   * headlight beams and lamp pools out of it so the street underneath shows through.
   */
  private updateNight(night: boolean, px: number, py: number): void {
    const car = this.car;
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    const beamX = car.x + fx * 13;
    const beamY = car.y + fy * 13;
    const tx = Math.floor(car.x / TILE);
    const ty = Math.floor(car.y / TILE);
    const inTunnel = this.map.inb(tx, ty) && (this.map.flags[this.map.idx(tx, ty)] & F.TUNNEL) !== 0;

    // Warm additive tint on top of the revealed area (and the only light effect in tunnels by day).
    this.headlight
      .setVisible(car.lights && (night || inTunnel))
      .setAlpha(night ? 0.22 : 0.4)
      .setPosition(beamX, beamY)
      .setRotation(car.heading);

    this.dark.setVisible(night);
    if (!night) return;
    const cam = this.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;
    this.dark.setPosition(cx, cy);
    const ox = cx - DARK_W / 2;
    const oy = cy - DARK_H / 2;
    const inView = (x: number, y: number, r: number) => x > ox - r && x < ox + DARK_W + r && y > oy - r && y < oy + DARK_H + r;

    this.dark.clear();
    this.dark.fill(0x070b1e, 0.84);

    // Street lamps.
    for (const lamp of this.decor.lamps()) {
      if (!inView(lamp.x, lamp.y, 140)) continue;
      this.eraseGlow.setScale(lamp.scale * 0.75).setAlpha(0.55);
      this.dark.erase(this.eraseGlow, lamp.x - ox, lamp.y - oy);
    }
    // NPC headlights (they always drive with lights on, of course).
    this.eraseBeam.setScale(0.55).setAlpha(0.6);
    for (const n of this.traffic.cars) {
      if (!inView(n.x, n.y, 200)) continue;
      const c = Math.cos(n.heading);
      const s = Math.sin(n.heading);
      this.eraseBeam.setRotation(n.heading);
      this.dark.erase(this.eraseBeam, n.x + c * n.half - ox, n.y + s * n.half - oy);
    }
    const amb = this.traffic.ambulance;
    if (amb && inView(amb.x, amb.y, 200)) {
      this.eraseBeam.setRotation(0);
      this.dark.erase(this.eraseBeam, amb.x + 18 - ox, amb.y - oy);
    }
    // The player's own headlights.
    if (car.lights) {
      this.eraseBeam.setScale(1.15, 1).setAlpha(1).setRotation(car.heading);
      this.dark.erase(this.eraseBeam, beamX - ox, beamY - oy);
    }
    // A little ambient light around the player so you can see yourself.
    this.eraseGlow.setScale(0.7).setAlpha(0.45);
    this.dark.erase(this.eraseGlow, px - ox, py - oy);
  }

  hud(): HudState {
    const inCar = this.mode === 'car';
    const px = inCar ? this.car.x : this.foot.x;
    const py = inCar ? this.car.y : this.foot.y;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const i = this.map.inb(tx, ty) ? this.map.idx(tx, ty) : 0;
    const zone = this.map.zone[i];
    const st = this.map.streetOf(tx, ty);
    const m = this.missions?.mission;
    return {
      mode: this.mode,
      speed: Math.abs(this.car.speedKmh),
      limit: inCar ? ZONE_LIMIT[zone] : Infinity,
      zoneName: inCar ? ZONE_NAME[zone] : this.map.flags[i] & F.LAWN && this.map.type[i] === T.GRASS ? 'Rasen betreten verboten!' : 'On foot',
      street: st ? st.name : '',
      money: this.bureau.money,
      points: this.bureau.points,
      clock: this.clock.format(),
      quiet: this.clock.quietLabel(),
      blinker: this.car.blinker,
      blinkOn: this.car.blinkPhase() === 0,
      belt: this.car.belt,
      lights: this.car.lights,
      disc: this.car.disc,
      missionTitle: m ? m.title : '',
      missionNo: m ? m.id : 0,
      objective: this.missions?.objectiveText() ?? '',
      rescueLane: this.rules.status.rescueLane,
      pedLight: this.mode === 'foot' ? this.rules.status.pedLight : null,
      waiting: this.clock.waiting,
      px: px / TILE,
      py: py / TILE,
      carX: this.car.x / TILE,
      carY: this.car.y / TILE,
      target: this.missions?.objective?.target ?? null,
      night: this.clock.isNight,
      autobahn: zone === Z.AUTOBAHN,
    };
  }

  private debugTeleport(): void {
    const tgt = this.missions.objective?.target;
    if (!tgt) return;
    const x = (tgt.x + tgt.w / 2) * TILE;
    const y = (tgt.y + tgt.h / 2) * TILE;
    if (this.mode === 'car') this.car.place(x, y, this.car.heading);
    else this.foot.place(x, y);
  }
}
