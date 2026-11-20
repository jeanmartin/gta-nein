import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { formatEur, type IncomeLine } from '../systems/Bureaucracy';
import { Sfx } from '../systems/Sfx';
import type { GameStats } from './GameScene';

const FONT_BOLD = 'Arial Black, Arial, sans-serif';
const FONT = 'Arial, Helvetica, sans-serif';

export class EndingScene extends Phaser.Scene {
  private stats!: GameStats;
  private tax!: { lines: IncomeLine[]; total: number; years: number };
  private stage = 0;

  constructor() {
    super('Ending');
  }

  init(data: { stats: GameStats; tax: { lines: IncomeLine[]; total: number; years: number } }): void {
    this.stats = data.stats;
    this.tax = data.tax;
    this.stage = 0;
  }

  create(): void {
    this.cameras.main.fadeIn(600);
    this.letter();
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.stage === 1) {
        this.stage = 2;
        Sfx.stamp();
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.children.removeAll(true);
          this.cameras.main.fadeIn(500);
          this.cell();
        });
      } else if (this.stage === 3) {
        this.scene.start('Title');
      }
    });
  }

  private letter(): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x111111).setOrigin(0).setDepth(-2);
    const W = 760;
    const X = (GAME_W - W) / 2;
    const Y = 40;
    const g = this.add.graphics();
    let y = Y + 28;
    const t = (x: number, yy: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) => this.add.text(x, yy, s, style);
    t(X + 36, y, 'Finanzamt Bad Regelsheim · Steuerfahndung', { fontFamily: FONT_BOLD, fontSize: '15px', color: '#1c3b6e' });
    y += 26;
    const subj = t(X + 36, y, 'Betreff: Criminal tax proceedings for evasion of the Bremsflüssigkeitssteuer (BremsFlStG)', {
      fontFamily: FONT_BOLD,
      fontSize: '15px',
      color: '#111',
      wordWrap: { width: W - 72 },
    });
    y += subj.height + 12;
    const body = [
      'Sehr geehrte/r Steuerpflichtige/r,',
      `congratulations on filing your income tax return on time. While processing it, we noticed that during the period under review you used ${this.stats.brakeFluidL.toFixed(2)} litres of brake fluid (DOT 4) by braking, without ever filing a Bremsflüssigkeitssteuer-Voranmeldung (advance return).`,
      'Every careful stop, every full stop at a STOP sign and every Spielstraße crawl was recorded by your Bürgerfahrtenschreiber. The more carefully you drove, the more you braked. The more you braked, the more tax you evaded.',
    ];
    for (const p of body) {
      const o = t(X + 36, y, p, { fontFamily: FONT, fontSize: '14px', color: '#222', wordWrap: { width: W - 72 }, lineSpacing: 2 });
      y += o.height + 8;
    }
    for (const row of this.tax.lines) {
      t(X + 52, y, row.label, { fontFamily: FONT, fontSize: '13px', color: '#222' });
      t(X + W - 52, y, formatEur(row.amount), { fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#b00000' }).setOrigin(1, 0);
      y += 19;
    }
    g.fillStyle(0x333333).fillRect(X + 52, y + 2, W - 104, 1);
    y += 6;
    t(X + 52, y, 'Total due', { fontFamily: FONT_BOLD, fontSize: '14px', color: '#111' });
    t(X + W - 52, y, formatEur(this.tax.total), { fontFamily: FONT_BOLD, fontSize: '14px', color: '#b00000' }).setOrigin(1, 0);
    y += 28;
    const verdict = t(
      X + 36,
      y,
      `Your account balance (${formatEur(this.stats.money)}) is not enough. You are therefore sentenced to ${this.tax.years} years in JVA Bad Regelsheim. (Open prison is not available: waiting time 6–8 years.)`,
      { fontFamily: FONT_BOLD, fontSize: '14px', color: '#111', wordWrap: { width: W - 72 } },
    );
    y += verdict.height + 18;
    const prompt = t(X + W / 2, y, '[ENTER]  Acknowledge receipt', { fontFamily: FONT_BOLD, fontSize: '15px', color: '#b00000' }).setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    y += 40;
    g.fillStyle(0xf4efe1).fillRect(X, Y, W, y - Y);
    g.setDepth(-1);
    this.time.delayedCall(400, () => (this.stage = 1));
  }

  private cell(): void {
    const g = this.add.graphics();
    g.fillStyle(0x3d3f44).fillRect(0, 0, GAME_W, GAME_H);
    // Brick wall.
    g.fillStyle(0x4a4c52);
    for (let y = 0; y < 470; y += 24)
      for (let x = (y / 24) % 2 === 0 ? 0 : -30; x < GAME_W; x += 60) g.fillRect(x + 2, y + 2, 56, 20);
    g.fillStyle(0x2a2b2f).fillRect(0, 470, GAME_W, GAME_H - 470);
    // Bunk.
    g.fillStyle(0x6b4a2b).fillRect(820, 380, 300, 30);
    g.fillStyle(0xdcdcdc).fillRect(830, 362, 280, 20);
    // Calendar with tally marks.
    g.fillStyle(0xf4efe1).fillRect(140, 120, 160, 190);
    g.lineStyle(3, 0x222222);
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) g.lineBetween(160 + k * 12 + i * 35, 170, 160 + k * 12 + i * 35, 215);
      g.lineBetween(152 + i * 35, 210, 205 + i * 35, 176);
    }
    this.add.text(220, 132, 'STEUERJAHR', { fontFamily: FONT_BOLD, fontSize: '14px', color: '#b00000' }).setOrigin(0.5, 0);
    // The prisoner, in regulation stripes, sitting by the bunk.
    const px = 980;
    const py = 300;
    g.fillStyle(0xf0c8a0).fillCircle(px, py - 70, 26);
    g.fillStyle(0x5a4a2a).fillRect(px - 28, py - 100, 56, 12); // hat brim
    g.fillRect(px - 18, py - 116, 36, 18);
    g.fillStyle(0x222222).fillCircle(px - 9, py - 72, 3).fillCircle(px + 9, py - 72, 3);
    g.lineStyle(3, 0x222222).beginPath().arc(px, py - 52, 9, Math.PI * 1.15, Math.PI * 1.85).strokePath(); // frown
    for (let k = 0; k < 6; k++) g.fillStyle(k % 2 ? 0x222222 : 0xeeeeee).fillRect(px - 34, py - 42 + k * 16, 68, 16);
    g.fillStyle(0x222222).fillRect(px - 30, py + 54, 24, 26).fillRect(px + 6, py + 54, 24, 26);
    // Bars.
    g.fillStyle(0x15161a);
    for (let x = 20; x < GAME_W; x += 70) g.fillRect(x, 0, 14, GAME_H);
    g.fillRect(0, 60, GAME_W, 16);
    g.fillRect(0, GAME_H - 120, GAME_W, 16);

    const nein = this.add
      .text(GAME_W / 2, 230, 'NEIN!', { fontFamily: FONT_BOLD, fontSize: '170px', color: '#e01e1e', stroke: '#ffffff', strokeThickness: 10 })
      .setOrigin(0.5)
      .setRotation(-0.12)
      .setScale(4)
      .setAlpha(0);
    this.tweens.add({
      targets: nein,
      scale: 1,
      alpha: 1,
      duration: 260,
      delay: 600,
      ease: 'Quad.easeIn',
      onStart: () => this.time.delayedCall(240, () => {
        Sfx.stamp();
        Sfx.nein();
        this.cameras.main.shake(300, 0.01);
      }),
    });

    const s = this.stats;
    const lines = [
      'You followed every rule. Except the one nobody told you about.',
      '',
      `Fines received: ${s.fineCount}  (${formatEur(s.finesTotal)})`,
      `Points in Flensburg: ${s.points}`,
      `Taxes & fees paid: ${formatEur(s.taxesPaid)}`,
      `Brake fluid used (untaxed): ${s.brakeFluidL.toFixed(2)} l`,
    ];
    const txt = this.add
      .text(GAME_W / 2, 400, lines.join('\n'), {
        fontFamily: FONT_BOLD,
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000',
        strokeThickness: 5,
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, delay: 1500, duration: 800 });
    const credits = this.add
      .text(GAME_W / 2, GAME_H - 46, 'GTA NEIN! · GAME ÜBER · [ENTER] Apply for release (Antrag auf Haftentlassung)', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffd400',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: credits, alpha: 1, delay: 2600, duration: 600, onComplete: () => (this.stage = 3) });
  }
}
