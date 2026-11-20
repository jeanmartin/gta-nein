import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { MISSIONS } from '../missions';
import { Sfx } from '../systems/Sfx';
import { loadSave } from './GameScene';

const FONT_BOLD = 'Arial Black, Arial, sans-serif';
const FONT = 'Arial, Helvetica, sans-serif';

export class TitleScene extends Phaser.Scene {
  private busy = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.busy = false;
    const params = new URLSearchParams(location.search);
    const debug = params.has('debug');
    const g = this.add.graphics();
    // Diagonal black-red-gold stripes, very official.
    const cols = [0x1a1a1a, 0x8c1c13, 0xb8860b];
    for (let i = -10; i < 30; i++) {
      g.fillStyle(cols[((i % 3) + 3) % 3], 0.35);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(i * 90, 0),
          new Phaser.Math.Vector2(i * 90 + 90, 0),
          new Phaser.Math.Vector2(i * 90 + 90 - 400, GAME_H),
          new Phaser.Math.Vector2(i * 90 - 400, GAME_H),
        ],
        true,
      );
    }
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0c0c, 0.6).setOrigin(0);

    this.add.text(GAME_W / 2 - 120, 150, 'GTA', { fontFamily: FONT_BOLD, fontSize: '150px', color: '#f4efe1', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5);
    const nein = this.add
      .text(GAME_W / 2 + 205, 170, 'NEIN!', { fontFamily: FONT_BOLD, fontSize: '96px', color: '#e01e1e', stroke: '#fff', strokeThickness: 6 })
      .setOrigin(0.5)
      .setRotation(-0.14);
    this.tweens.add({ targets: nein, scale: { from: 1, to: 1.06 }, yoyo: true, repeat: -1, duration: 700 });
    this.add
      .text(GAME_W / 2, 262, 'Gewissenhafte Teilnahme am Autoverkehr', { fontFamily: FONT_BOLD, fontSize: '24px', color: '#ffd400' })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 296, 'A game about order, punctuality and brake fluid. Obey every rule. Follow every order.', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#dddddd',
      })
      .setOrigin(0.5);

    const save = loadSave();
    const lines = ['[ENTER]  Apply to start the game (Antrag auf Spielbeginn stellen)'];
    if (save) lines.push(`[C]  Continue — order ${save.mission + 1}/8 "${MISSIONS[save.mission]?.title ?? ''}"`);
    if (debug) lines.push('[1–8]  DEBUG: jump to order');
    const menu = this.add
      .text(GAME_W / 2, 380, lines.join('\n'), { fontFamily: FONT_BOLD, fontSize: '20px', color: '#ffffff', align: 'center', lineSpacing: 12 })
      .setOrigin(0.5, 0);
    this.tweens.add({ targets: menu, alpha: 0.7, yoyo: true, repeat: -1, duration: 900 });

    this.add
      .text(
        GAME_W / 2,
        540,
        'W/A/S/D drive · B seatbelt · Q/E indicator · SPACE handbrake / use · P Parkscheibe · F get in/out · L lights · Z wait · ESC pause',
        { fontFamily: FONT, fontSize: '14px', color: '#bbbbbb', align: 'center', wordWrap: { width: 1000 } },
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_W / 2,
        GAME_H - 40,
        'A private satire. All authorities, laws, paragraphs and Rentner are fictional. Mostly.',
        { fontFamily: FONT, fontSize: '12px', color: '#888888' },
      )
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    const urlMission = Number(params.get('mission'));
    kb.on('keydown-ENTER', () => this.go(Number.isFinite(urlMission) && urlMission >= 1 && urlMission <= 8 ? urlMission - 1 : 0, null));
    if (save) kb.on('keydown-C', () => this.go(save.mission, save.bureau));
    if (debug)
      for (let i = 1; i <= 8; i++) {
        const names = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
        kb.on(`keydown-${names[i - 1]}`, () => this.go(i - 1, null));
      }
  }

  private go(mission: number, restore: unknown): void {
    if (this.busy) return;
    this.busy = true;
    Sfx.unlock();
    Sfx.stamp();
    const st = this.add
      .text(GAME_W / 2, GAME_H / 2, 'GENEHMIGT', { fontFamily: FONT_BOLD, fontSize: '80px', color: '#1e7d32', stroke: '#1e7d32', strokeThickness: 2 })
      .setOrigin(0.5)
      .setRotation(-0.2)
      .setScale(3)
      .setAlpha(0);
    this.tweens.add({ targets: st, scale: 1, alpha: 0.9, duration: 140 });
    this.time.delayedCall(700, () => this.scene.start('Game', { mission, restore }));
  }
}
