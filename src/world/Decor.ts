/** Static and animated world decorations: signs, lights, Blitzer, Rentner, labels, tunnels. */
import Phaser from 'phaser';
import { TILE } from '../config';
import { CONTAINERS, TUNNELS, WERTSTOFF_PLAZA } from './cityLayout';
import type { LightHeadDef, MapData } from './MapData';
import { lampFor, lightAt, pedGreen } from './TrafficLights';
import { ANGLE, CARDS, T, VEC } from './types';

export class Decor {
  private heads: { img: Phaser.GameObjects.Image; def: LightHeadDef; key: string }[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  readonly blitzerImgs: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapData,
  ) {
    const s = scene;
    for (const sg of map.signs) {
      const key =
        sg.kind === 'stop' ? 'sign_stop' : sg.kind === 'autobahn' ? 'sign_autobahn' : sg.kind === 'spiel' ? 'sign_spiel' : `sign_${sg.value}`;
      if (s.textures.exists(key)) s.add.image(sg.x, sg.y, key).setDepth(15).setScale(0.8);
    }
    for (const def of map.lightHeads) {
      const key = def.ped ? 'ped_red' : 'tl_red';
      const img = s.add.image(def.x, def.y, key).setDepth(16).setScale(def.ped ? 0.9 : 0.75);
      this.heads.push({ img, def, key });
    }
    for (const b of map.blitzers) {
      this.blitzerImgs.push(s.add.image(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, 'blitzer').setDepth(15));
    }
    for (const r of map.rentner) {
      const card = CARDS.find((c) => map.typeAt(r.x + VEC[c][0], r.y + VEC[c][1]) === T.SIDEWALK) ?? 'S';
      const [dx, dy] = VEC[card];
      s.add
        .image(r.x * TILE + TILE / 2 + dx * 9, r.y * TILE + TILE / 2 + dy * 9, 'rentner')
        .setRotation(ANGLE[card] - Math.PI / 2)
        .setDepth(14);
    }
    for (const c of CONTAINERS) s.add.image(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, `container_${c.label}`).setDepth(15);

    const label = (text: string, x: number, y: number, size = 15) =>
      s.add
        .text(x, y, text, {
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: `${size}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0.85);
    for (const p of map.pois) {
      if (!p.label || p.rect.w === 0) continue;
      label(p.label, (p.rect.x + p.rect.w / 2) * TILE, (p.rect.y + p.rect.h / 2) * TILE, p.rect.w < 8 ? 12 : 16);
    }
    label('WERTSTOFFINSEL', (WERTSTOFF_PLAZA.x + WERTSTOFF_PLAZA.w / 2) * TILE, (WERTSTOFF_PLAZA.y + 0.6) * TILE, 11);
    label('STADTPARK', 22.5 * TILE, 50 * TILE, 14);

    for (const t of TUNNELS) {
      const g = s.add.graphics().setDepth(26);
      g.fillStyle(0x2b2b30, 0.6);
      g.fillRect(t.x * TILE, (t.y - 0.4) * TILE, t.w * TILE, (t.h + 0.8) * TILE);
      g.lineStyle(3, 0x1a1a1a, 0.9);
      g.strokeRect(t.x * TILE, (t.y - 0.4) * TILE, t.w * TILE, (t.h + 0.8) * TILE);
      label('TUNNEL', (t.x + t.w / 2) * TILE, (t.y + 1) * TILE, 12).setAlpha(0.5);
    }

    // Street lights (visible at night).
    for (const is of map.intersections) {
      const img = s.add.image(is.cx, is.cy, 'glow').setDepth(51).setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.glows.push(img);
    }
    for (let x = 14; x < 113; x += 9)
      for (const y of [19, 43, 65, 81]) {
        const img = s.add.image(x * TILE, y * TILE + 8, 'glow').setDepth(51).setScale(1.6).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        this.glows.push(img);
      }
  }

  /** Street lamps, for cutting light into the night overlay. */
  lamps(): readonly Phaser.GameObjects.Image[] {
    return this.glows;
  }

  update(t: number, night: boolean): void {
    for (const h of this.heads) {
      const is = this.map.intersections[h.def.isect];
      const st = lightAt(t, is.offset);
      const key = h.def.ped ? (pedGreen(st, h.def.axis) ? 'ped_green' : 'ped_red') : `tl_${lampFor(st, h.def.axis)}`;
      if (key !== h.key) {
        h.img.setTexture(key);
        h.key = key;
      }
    }
    for (const g of this.glows) g.setVisible(night).setAlpha(0.35);
    void this.scene;
  }
}
