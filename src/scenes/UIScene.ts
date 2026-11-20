import Phaser from 'phaser';
import { GAME_H, GAME_W, MAX_POINTS } from '../config';
import type { Letter } from '../missions/types';
import { formatEur, type FineRecord } from '../systems/Bureaucracy';
import { Sfx } from '../systems/Sfx';
import type { GameScene } from './GameScene';

const FONT = 'Arial, Helvetica, sans-serif';
const FONT_BOLD = 'Arial Black, Arial, sans-serif';
const PAPER = 0xf4efe1;

export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  letterOpen = false;
  paused = false;

  private speedText!: Phaser.GameObjects.Text;
  private limitG!: Phaser.GameObjects.Graphics;
  private limitText!: Phaser.GameObjects.Text;
  private zoneText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private pointsG!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private quietText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  private objText!: Phaser.GameObjects.Text;
  private missionBox!: Phaser.GameObjects.Graphics;
  private chips!: Phaser.GameObjects.Text;
  private extraChip!: Phaser.GameObjects.Text;
  private keyHint!: Phaser.GameObjects.Text;
  private minimapDots!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private cards: Phaser.GameObjects.Container[] = [];
  private letterLayer?: Phaser.GameObjects.Container;
  private letterQueue: Letter[] = [];
  private letterDone: (() => void) | null = null;
  private pauseLayer?: Phaser.GameObjects.Container;
  private lastMoney = NaN;

  constructor() {
    super('UI');
  }

  init(data: { game: GameScene }): void {
    this.game_ = data.game;
    this.letterOpen = false;
    this.paused = false;
    this.cards = [];
    this.letterQueue = [];
    this.letterDone = null;
    this.letterLayer = undefined;
    this.pauseLayer = undefined;
  }

  create(): void {
    const panel = (x: number, y: number, w: number, h: number) =>
      this.add.graphics().fillStyle(0x111111, 0.72).fillRoundedRect(x, y, w, h, 8).lineStyle(2, 0xffffff, 0.15).strokeRoundedRect(x, y, w, h, 8);

    // Speed panel (top-left).
    panel(14, 14, 270, 104);
    this.speedText = this.add.text(30, 20, '0', { fontFamily: FONT_BOLD, fontSize: '46px', color: '#ffffff' });
    this.add.text(30, 74, 'km/h', { fontFamily: FONT, fontSize: '13px', color: '#aaaaaa' });
    this.limitG = this.add.graphics();
    this.limitText = this.add.text(240, 50, '', { fontFamily: FONT_BOLD, fontSize: '17px', color: '#111' }).setOrigin(0.5);
    this.zoneText = this.add.text(30, 92, '', { fontFamily: FONT, fontSize: '12px', color: '#ffd400', wordWrap: { width: 250 } });

    // Money / points / clock (top-right).
    panel(GAME_W - 284, 14, 270, 104);
    this.add.text(GAME_W - 270, 22, 'KONTOSTAND', { fontFamily: FONT, fontSize: '11px', color: '#aaaaaa' });
    this.moneyText = this.add.text(GAME_W - 270, 36, '', { fontFamily: FONT_BOLD, fontSize: '22px', color: '#7CFC00' });
    this.add.text(GAME_W - 270, 68, 'PUNKTE IN FLENSBURG', { fontFamily: FONT, fontSize: '11px', color: '#aaaaaa' });
    this.pointsG = this.add.graphics();
    this.clockText = this.add.text(GAME_W - 30, 22, '', { fontFamily: FONT_BOLD, fontSize: '16px', color: '#ffffff' }).setOrigin(1, 0);
    this.quietText = this.add.text(GAME_W - 30, 44, '', { fontFamily: FONT, fontSize: '12px', color: '#ff9f43' }).setOrigin(1, 0);

    // Mission box (top-centre).
    this.missionBox = this.add.graphics();
    this.missionText = this.add.text(GAME_W / 2, 20, '', { fontFamily: FONT_BOLD, fontSize: '13px', color: '#ffd400' }).setOrigin(0.5, 0);
    this.objText = this.add
      .text(GAME_W / 2, 40, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center', wordWrap: { width: 560 } })
      .setOrigin(0.5, 0);

    // Minimap (bottom-left).
    const mmScale = 1.25;
    const mmX = 14;
    const mmY = GAME_H - 96 * mmScale - 14;
    panel(mmX - 4, mmY - 4, 200 * mmScale + 8, 96 * mmScale + 8);
    if (this.textures.exists('minimap')) this.add.image(mmX, mmY, 'minimap').setOrigin(0).setScale(mmScale).setAlpha(0.9);
    this.minimapDots = this.add.graphics();
    this.minimapDots.setData('mm', { x: mmX, y: mmY, s: mmScale });

    // Status chips (bottom-centre).
    this.chips = this.add
      .text(GAME_W / 2 + 60, GAME_H - 44, '', {
        fontFamily: FONT_BOLD,
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5);
    // Key legend under the chips, so the controls are learnable in play.
    this.keyHint = this.add
      .text(GAME_W / 2 + 60, GAME_H - 15, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#dddddd',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5);
    this.extraChip = this.add
      .text(GAME_W / 2 + 60, GAME_H - 78, '', { fontFamily: FONT_BOLD, fontSize: '14px', color: '#ffffff', padding: { x: 10, y: 4 } })
      .setOrigin(0.5);
    this.toastText = this.add
      .text(GAME_W / 2 + 60, GAME_H - 118, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#1c3b6ecc',
        padding: { x: 12, y: 6 },
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.input.keyboard!.on('keydown-ENTER', () => this.advanceLetter());
    this.input.keyboard!.on('keydown-R', () => {
      if (this.paused) {
        this.togglePause();
        this.game_.restartMission();
      }
    });
    this.input.keyboard!.on('keydown-T', () => {
      if (this.paused) {
        this.scene.stop('Game');
        this.scene.start('Title');
      }
    });
    this.events.emit('ui-ready');
  }

  update(): void {
    const g = this.game_;
    if (!g || !g.sys.isActive() && !g.sys.isPaused()) return;
    const h = g.hud();

    this.speedText.setText(h.mode === 'car' ? String(Math.round(h.speed)) : '—');
    const over = Number.isFinite(h.limit) && Math.round(h.speed) > h.limit;
    this.speedText.setColor(over ? '#ff4040' : '#ffffff');
    this.limitG.clear();
    if (h.mode === 'car' && Number.isFinite(h.limit)) {
      this.limitG.fillStyle(0xffffff).fillCircle(240, 50, 26).lineStyle(6, 0xd41b1b).strokeCircle(240, 50, 23);
      this.limitText.setText(String(h.limit)).setVisible(true);
    } else if (h.mode === 'car' && h.autobahn) {
      this.limitG.fillStyle(0x1d4fa3).fillRoundedRect(214, 26, 52, 48, 5);
      this.limitText.setText('130').setColor('#ffffff').setVisible(true);
    } else this.limitText.setVisible(false);
    if (Number.isFinite(h.limit)) this.limitText.setColor('#111');
    this.zoneText.setText([h.zoneName, h.street].filter(Boolean).join(' · '));

    if (h.money !== this.lastMoney) {
      this.moneyText.setText(formatEur(h.money)).setColor(h.money < 200 ? '#ff4040' : '#7CFC00');
      if (!Number.isNaN(this.lastMoney) && h.money < this.lastMoney) {
        this.tweens.add({ targets: this.moneyText, scale: { from: 1.25, to: 1 }, duration: 250 });
      }
      this.lastMoney = h.money;
    }
    this.pointsG.clear();
    for (let i = 0; i < MAX_POINTS; i++) {
      const x = GAME_W - 270 + i * 30;
      this.pointsG.fillStyle(i < h.points ? 0xff3b30 : 0x444444).fillRoundedRect(x, 86, 24, 18, 3);
    }
    this.clockText.setText(h.clock);
    this.quietText.setText(h.quiet ? `🤫 ${h.quiet}` : h.night ? 'Nacht · Licht an!' : '');

    // Mission.
    this.missionBox.clear();
    if (h.objective) {
      this.missionText.setText(`ANORDNUNG ${h.missionNo}/8 · ${h.missionTitle.toUpperCase()}`);
      this.objText.setText(h.objective);
      const bh = 34 + this.objText.height;
      this.missionBox.fillStyle(0x111111, 0.75).fillRoundedRect(GAME_W / 2 - 300, 12, 600, bh, 8);
    } else {
      this.missionText.setText('');
      this.objText.setText('');
    }

    // Chips.
    if (h.mode === 'car') {
      const L = h.blinker < 0 ? (h.blinkOn ? '◀◀' : '◁◁') : '◁';
      const R = h.blinker > 0 ? (h.blinkOn ? '▶▶' : '▷▷') : '▷';
      this.chips.setText(
        `[Q] ${L}   [B] GURT ${h.belt ? '✔' : '✘'}   [L] LICHT ${h.lights ? '✔' : '–'}   [P] PARKSCHEIBE ${h.disc ? '✔' : '–'}   ${R} [E]`,
      );
      this.chips.setColor(h.belt ? '#ffffff' : '#ffb3b3');
      this.keyHint.setText('WASD/↑↓←→ fahren · SPACE Handbremse · H Hupe (€0,50) · F aussteigen · Z warten · M Ton · ESC Pause');
    } else {
      this.chips.setText('ZU FUSS').setColor('#ffffff');
      this.keyHint.setText('WASD/↑↓←→ gehen · SHIFT laufen · SPACE benutzen · F einsteigen · Z warten · M Ton · ESC Pause');
    }
    let extra = '';
    let bg = '#00000000';
    if (h.rescueLane !== null) {
      extra = h.rescueLane ? 'RETTUNGSGASSE ✔' : 'RETTUNGSGASSE BILDEN! (move to the edge of your lane)';
      bg = h.rescueLane ? '#1e7d32dd' : '#c62828dd';
    } else if (h.pedLight) {
      extra = h.pedLight === 'green' ? 'AMPELMÄNNCHEN: GRÜN' : 'AMPELMÄNNCHEN: ROT — wait!';
      bg = h.pedLight === 'green' ? '#1e7d32dd' : '#c62828dd';
    } else if (h.waiting) {
      extra = '⏳ Sie warten … (Z)';
      bg = '#333333dd';
    }
    this.extraChip.setText(extra).setBackgroundColor(bg).setVisible(extra !== '');

    // Minimap dots.
    const mm = this.minimapDots.getData('mm') as { x: number; y: number; s: number };
    this.minimapDots.clear();
    if (h.target) {
      const pulse = Math.floor(this.time.now / 300) % 2 === 0;
      this.minimapDots
        .fillStyle(0xffd400, pulse ? 1 : 0.5)
        .fillRect(mm.x + (h.target.x - 1) * mm.s, mm.y + (h.target.y - 1) * mm.s, (h.target.w + 2) * mm.s, (h.target.h + 2) * mm.s);
    }
    if (h.mode === 'foot') this.minimapDots.fillStyle(0x66ccff).fillCircle(mm.x + h.carX * mm.s, mm.y + h.carY * mm.s, 2.5);
    this.minimapDots.fillStyle(0xffffff).fillCircle(mm.x + h.px * mm.s, mm.y + h.py * mm.s, 3.5).lineStyle(1, 0x000000).strokeCircle(mm.x + h.px * mm.s, mm.y + h.py * mm.s, 3.5);
  }

  // ───────────────────────────── notifications ─────────────────────────────
  toast(text: string): void {
    this.toastText.setText(text).setVisible(true).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(3600, () => this.toastText.setVisible(false));
  }

  banner(title: string, sub?: string): void {
    const c = this.add.container(GAME_W / 2, 250).setDepth(80);
    const t = this.add.text(0, 0, title, { fontFamily: FONT_BOLD, fontSize: '44px', color: '#ffd400', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
    c.add(t);
    if (sub) c.add(this.add.text(0, 44, sub, { fontFamily: FONT_BOLD, fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    c.setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2800, duration: 500, onComplete: () => c.destroy() });
  }

  nein(): void {
    const t = this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, 'NEIN!', { fontFamily: FONT_BOLD, fontSize: '96px', color: '#e01e1e', stroke: '#ffffff', strokeThickness: 8 })
      .setOrigin(0.5)
      .setRotation(-0.12)
      .setDepth(70)
      .setScale(2.4)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 140, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: t, alpha: 0, scale: 1.1, delay: 650, duration: 350, onComplete: () => t.destroy() });
  }

  fine(r: FineRecord): void {
    const w = 340;
    const lines: string[] = [];
    if (r.detail) lines.push(r.detail);
    lines.push(`"${r.flavour}"`);
    const c = this.add.container(GAME_W + w, 0).setDepth(75);
    const bg = this.add.graphics();
    const header = this.add.text(12, 8, r.kind.toUpperCase(), { fontFamily: FONT_BOLD, fontSize: '13px', color: '#b00000' });
    const az = this.add.text(w - 12, 9, `Az. ${r.az}`, { fontFamily: 'Courier New, monospace', fontSize: '11px', color: '#555' }).setOrigin(1, 0);
    const title = this.add.text(12, 28, r.title, { fontFamily: FONT_BOLD, fontSize: '13px', color: '#111', wordWrap: { width: w - 24 } });
    const body = this.add.text(12, 30 + title.height, lines.join('\n'), {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#333',
      wordWrap: { width: w - 24 },
    });
    const amountY = 36 + title.height + body.height;
    const amt = this.add.text(12, amountY, `${r.law} · ${formatEur(r.amount)}${r.fee ? ` + ${formatEur(r.fee)} Gebühren` : ''}`, {
      fontFamily: FONT,
      fontSize: '11px',
      color: '#555',
    });
    const total = this.add
      .text(w - 12, amountY + 15, `${formatEur(r.total)}${r.points ? `  +${r.points} Pkt. Flensburg` : ''}`, { fontFamily: FONT_BOLD, fontSize: '15px', color: '#b00000' })
      .setOrigin(1, 0);
    const h = amountY + 40;
    bg.fillStyle(0x000000, 0.3).fillRect(4, 4, w, h);
    bg.fillStyle(PAPER).fillRect(0, 0, w, h);
    bg.fillStyle(0xb00000).fillRect(0, 0, 5, h);
    c.add([bg, header, az, title, body, amt, total]);
    c.setData('h', h);
    this.cards.unshift(c);
    while (this.cards.length > 4) {
      const old = this.cards.pop()!;
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    this.layoutCards();
    this.time.delayedCall(6500, () => {
      if (!c.active) return;
      this.tweens.add({
        targets: c,
        x: GAME_W + w,
        duration: 300,
        onComplete: () => {
          this.cards = this.cards.filter((k) => k !== c);
          c.destroy();
        },
      });
    });
  }

  private layoutCards(): void {
    let y = 132;
    for (const c of this.cards) {
      this.tweens.add({ targets: c, x: GAME_W - 354, y, duration: 220, ease: 'Cubic.easeOut' });
      y += (c.getData('h') as number) + 8;
    }
  }

  // ───────────────────────────── letters ─────────────────────────────
  showLetters(letters: Letter[], done: () => void): void {
    this.letterQueue.push(...letters);
    const prev = this.letterDone;
    this.letterDone = prev
      ? () => {
          prev();
          done();
        }
      : done;
    if (!this.letterOpen) this.openNextLetter();
  }

  private openNextLetter(): void {
    const l = this.letterQueue.shift();
    if (!l) return;
    this.letterOpen = true;
    this.letterLayer?.destroy();
    const g = this.game_;
    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.65).setOrigin(0);
    layer.add(dim);
    const W = 720;
    const X = (GAME_W - W) / 2;
    const inner = this.add.container(X, 0);
    layer.add(inner);
    const bg = this.add.graphics();
    inner.add(bg);
    let y = 30;
    const add = (o: Phaser.GameObjects.Text) => {
      inner.add(o);
      return o;
    };
    add(this.add.text(36, y, l.from, { fontFamily: FONT_BOLD, fontSize: '14px', color: '#1c3b6e' }));
    add(
      this.add
        .text(W - 36, y, `${g.clock.format()} · Az. ${l.az ?? g.bureau.nextAz('BR')}`, { fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#555' })
        .setOrigin(1, 0),
    );
    y += 22;
    bg.fillStyle(0x1c3b6e).fillRect(36, y, W - 72, 2);
    y += 14;
    const subj = add(this.add.text(36, y, `Betreff: ${l.subject}`, { fontFamily: FONT_BOLD, fontSize: '15px', color: '#111', wordWrap: { width: W - 72 } }));
    y += subj.height + 12;
    for (const p of l.body) {
      const t = add(this.add.text(36, y, p, { fontFamily: FONT, fontSize: '14px', color: '#222', wordWrap: { width: W - 72 }, lineSpacing: 2 }));
      y += t.height + 8;
    }
    if (l.table) {
      let sum = 0;
      for (const row of l.table) {
        add(this.add.text(52, y, row.label, { fontFamily: FONT, fontSize: '13px', color: '#222' }));
        add(
          this.add
            .text(W - 52, y, formatEur(row.amount), { fontFamily: 'Courier New, monospace', fontSize: '13px', color: row.amount < 0 ? '#b00000' : '#1b5e20' })
            .setOrigin(1, 0),
        );
        sum += row.amount;
        y += 19;
      }
      bg.fillStyle(0x333333).fillRect(52, y + 2, W - 104, 1);
      y += 6;
      add(this.add.text(52, y, 'Total booked to your account', { fontFamily: FONT_BOLD, fontSize: '13px', color: '#111' }));
      add(this.add.text(W - 52, y, formatEur(sum), { fontFamily: FONT_BOLD, fontSize: '13px', color: sum < 0 ? '#b00000' : '#1b5e20' }).setOrigin(1, 0));
      y += 26;
    }
    y += 4;
    add(
      this.add.text(36, y, 'Mit freundlichen Grüßen\ni. A. Dr. Ewald Pfennigfuchser, Oberamtsrat', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#222',
        fontStyle: 'italic',
      }),
    );
    y += 40;
    add(
      this.add.text(36, y, 'This letter was produced by machine and is valid without a signature. Objections must be filed in writing, in triplicate, by fax.', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#777',
        wordWrap: { width: W - 72 },
      }),
    );
    y += 34;
    const prompt = add(
      this.add.text(W / 2, y, '[ENTER]  Acknowledge receipt (Kenntnisnahme bestätigen)', { fontFamily: FONT_BOLD, fontSize: '14px', color: '#b00000' }).setOrigin(0.5, 0),
    );
    this.tweens.add({ targets: prompt, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    y += 36;
    const H = y;
    const Y = Math.max(10, (GAME_H - H) / 2);
    inner.y = Y;
    bg.fillStyle(0x000000, 0.35).fillRect(6, 6, W, H);
    bg.fillStyle(PAPER).fillRect(0, 0, W, H);
    bg.lineStyle(1, 0xcfc6ad).strokeRect(0, 0, W, H);
    inner.sendToBack(bg);
    inner.setData('stamp', l.stamp ?? 'ZUR KENNTNIS GENOMMEN');
    inner.setData('h', H);
    layer.setData('inner', inner);
    layer.setData('ready', false);
    inner.setScale(0.96).setAlpha(0);
    this.tweens.add({ targets: inner, alpha: 1, scale: 1, duration: 200, onComplete: () => layer.setData('ready', true) });
    this.letterLayer = layer;
    Sfx.typewriter();
  }

  private advanceLetter(): void {
    const layer = this.letterLayer;
    if (!this.letterOpen || !layer || !layer.getData('ready')) return;
    layer.setData('ready', false);
    const inner = layer.getData('inner') as Phaser.GameObjects.Container;
    const H = inner.getData('h') as number;
    const stamp = this.add
      .text(720 - 170, H - 120, inner.getData('stamp') as string, {
        fontFamily: FONT_BOLD,
        fontSize: '22px',
        color: '#c62828',
        stroke: '#c62828',
        strokeThickness: 1,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setRotation(-0.25)
      .setScale(2.2)
      .setAlpha(0);
    inner.add(stamp);
    Sfx.stamp();
    this.tweens.add({ targets: stamp, scale: 1, alpha: 0.85, duration: 120 });
    this.time.delayedCall(520, () => {
      layer.destroy();
      this.letterLayer = undefined;
      if (this.letterQueue.length) this.openNextLetter();
      else {
        this.letterOpen = false;
        const d = this.letterDone;
        this.letterDone = null;
        d?.();
      }
    });
  }

  // ───────────────────────────── pause ─────────────────────────────
  togglePause(): void {
    if (this.letterOpen) return;
    this.paused = !this.paused;
    if (!this.paused) {
      this.pauseLayer?.destroy();
      this.pauseLayer = undefined;
      return;
    }
    const c = this.add.container(0, 0).setDepth(150);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0));
    c.add(this.add.text(GAME_W / 2, 120, 'PAUSE · Mittagspause', { fontFamily: FONT_BOLD, fontSize: '40px', color: '#ffd400' }).setOrigin(0.5));
    const help = [
      'W/A/S/D or arrow keys — drive / walk',
      'SPACE — handbrake (in the car) · use / pick up (on foot)',
      'Q / E — indicator left / right (Blinker)',
      'B — seatbelt   ·   L — headlights   ·   P — Parkscheibe',
      'F — get in / out   ·   H — horn (costs money)   ·   Z — wait (time passes faster)',
      'SHIFT — run (on foot)   ·   M — sound on/off',
      '',
      'ESC — continue   ·   R — restart current order   ·   T — back to title',
    ];
    c.add(this.add.text(GAME_W / 2, 200, help.join('\n'), { fontFamily: FONT, fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    this.pauseLayer = c;
  }
}
