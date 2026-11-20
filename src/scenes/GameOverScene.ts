import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { formatEur } from '../systems/Bureaucracy';
import { Sfx } from '../systems/Sfx';
import { loadSave, type GameStats } from './GameScene';

const FONT_BOLD = 'Arial Black, Arial, sans-serif';
const FONT = 'Arial, Helvetica, sans-serif';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { reason: 'pfaendung' | 'fuehrerschein'; stats: GameStats; mission: number }): void {
    const s = data.stats;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x141414).setOrigin(0).setDepth(-2);
    const W = 720;
    const X = (GAME_W - W) / 2;
    const Y = 70;
    const pf = data.reason === 'pfaendung';
    const from = pf ? 'Amtsgericht Bad Regelsheim · Gerichtsvollzieher' : 'Fahrerlaubnisbehörde Bad Regelsheim';
    const subject = pf ? 'Seizure and transfer order (Pfändungs- und Überweisungsbeschluss)' : 'Revocation of your driving licence (Entziehung der Fahrerlaubnis)';
    const body = pf
      ? [
          `Your account balance is ${formatEur(s.money)}. That is less than nothing, which is not allowed.`,
          'Your car has been seized and marked with the official seal (Pfandsiegel, popularly called the "Kuckuck"). Your sofa, your Gartenzwerg and your Bausparvertrag have been seized too.',
          `You received ${s.fineCount} fines totalling ${formatEur(s.finesTotal)}.`,
        ]
      : [
          `You have collected ${s.points} points in Flensburg. The limit is 8. Your licence is revoked with immediate effect.`,
          'Before you can get it back you must pass a medical-psychological assessment (MPU, popularly known as the "Idiotentest"). Waiting time: 6–8 months.',
          `You received ${s.fineCount} fines totalling ${formatEur(s.finesTotal)}.`,
        ];
    const g = this.add.graphics();
    let y = Y + 30;
    this.add.text(X + 36, y, from, { fontFamily: FONT_BOLD, fontSize: '15px', color: '#1c3b6e' });
    y += 28;
    const subj = this.add.text(X + 36, y, `Betreff: ${subject}`, { fontFamily: FONT_BOLD, fontSize: '16px', color: '#111', wordWrap: { width: W - 200 } });
    y += subj.height + 14;
    for (const p of body) {
      const t = this.add.text(X + 36, y, p, { fontFamily: FONT, fontSize: '15px', color: '#222', wordWrap: { width: W - 200 }, lineSpacing: 3 });
      y += t.height + 10;
    }
    y += 10;
    const save = loadSave();
    const opts = this.add.text(X + W / 2, y, `[ENTER]  File an objection (Widerspruch): retry order ${data.mission + 1}\n[ESC]  Give up (back to the title)`, {
      fontFamily: FONT_BOLD,
      fontSize: '15px',
      color: '#b00000',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5, 0);
    y += opts.height + 30;
    g.fillStyle(0xf4efe1).fillRect(X, Y, W, y - Y);
    g.setDepth(-1);

    // The seal.
    const sx = X + W - 90;
    const sy = Y + 110;
    const seal = this.add.container(sx, sy).setRotation(0.2).setAlpha(0).setScale(2);
    const sg = this.add.graphics();
    sg.fillStyle(pf ? 0x8c1c13 : 0x1c3b6e, 0.9).fillCircle(0, 0, 54);
    sg.lineStyle(3, 0xffffff).strokeCircle(0, 0, 46);
    seal.add(sg);
    seal.add(this.add.text(0, -6, pf ? 'PFAND-\nSIEGEL' : 'FÜHRER-\nSCHEIN\nWEG', { fontFamily: FONT_BOLD, fontSize: '13px', color: '#fff', align: 'center' }).setOrigin(0.5));
    this.tweens.add({ targets: seal, alpha: 1, scale: 1, delay: 400, duration: 160, onComplete: () => Sfx.stamp() });

    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Game', { mission: data.mission, restore: save?.bureau ?? null }));
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('Title'));
  }
}
