/** Draws the tile map into lazily created 1024×1024 canvas chunks. */
import Phaser from 'phaser';
import { CHUNK_PX, TILE } from '../config';
import { PARK } from './cityLayout';
import { approachPost, type MapData } from './MapData';
import { BIT, CARDS, F, T, VEC, Z, axisOf, hash2, type Card } from './types';

const ROOFS = ['#9b6a55', '#8a7f72', '#a8836b', '#7c6f64', '#b07a5a', '#6f7a80', '#8f8f86', '#a35f4b', '#7d6a5a', '#94877a'];

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export class MapRenderer {
  private chunks = new Map<string, Phaser.GameObjects.Image>();
  private stopLines = new Map<number, Card>();
  private readonly cols: number;
  private readonly rows: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapData,
  ) {
    this.cols = Math.ceil((map.w * TILE) / CHUNK_PX);
    this.rows = Math.ceil((map.h * TILE) / CHUNK_PX);
    for (const is of map.intersections) {
      if (is.control !== 'light' && is.control !== 'stop') continue;
      for (const c of CARDS) {
        if (is.control === 'stop' && is.stopAxis !== axisOf(c)) continue;
        const p = approachPost(is, c);
        // All lanes on that side heading into the junction.
        const lanes: [number, number][] = [];
        if (c === 'E' || c === 'W') for (let y = is.y0; y <= is.y1; y++) lanes.push([p.laneX, y]);
        else for (let x = is.x0; x <= is.x1; x++) lanes.push([x, p.laneY]);
        for (const [x, y] of lanes) if (map.isRoad(x, y) && map.dir[map.idx(x, y)] & BIT[c]) this.stopLines.set(map.idx(x, y), c);
      }
    }
  }

  /** Create chunks around the camera view and drop far away ones. */
  update(view: Phaser.Geom.Rectangle): void {
    const margin = 320;
    const x0 = Math.max(0, Math.floor((view.x - margin) / CHUNK_PX));
    const y0 = Math.max(0, Math.floor((view.y - margin) / CHUNK_PX));
    const x1 = Math.min(this.cols - 1, Math.floor((view.right + margin) / CHUNK_PX));
    const y1 = Math.min(this.rows - 1, Math.floor((view.bottom + margin) / CHUNK_PX));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.ensure(cx, cy);
    for (const [key, img] of this.chunks) {
      const [, sx, sy] = key.split('_');
      const cx = Number(sx);
      const cy = Number(sy);
      if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) {
        img.destroy();
        this.scene.textures.remove(key);
        this.chunks.delete(key);
      }
    }
  }

  destroy(): void {
    for (const [key, img] of this.chunks) {
      img.destroy();
      this.scene.textures.remove(key);
    }
    this.chunks.clear();
  }

  private ensure(cx: number, cy: number): void {
    const key = `chunk_${cx}_${cy}`;
    if (this.chunks.has(key)) return;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, CHUNK_PX, CHUNK_PX);
    if (!tex) return;
    const c = tex.getContext();
    const per = CHUNK_PX / TILE;
    for (let ty = 0; ty < per; ty++)
      for (let tx = 0; tx < per; tx++) {
        const x = cx * per + tx;
        const y = cy * per + ty;
        if (!this.map.inb(x, y)) continue;
        this.drawTile(c, x, y, tx * TILE, ty * TILE);
      }
    // Second pass: things that overhang tile borders (trees).
    for (let ty = 0; ty < per; ty++)
      for (let tx = 0; tx < per; tx++) {
        const x = cx * per + tx;
        const y = cy * per + ty;
        if (!this.map.inb(x, y)) continue;
        this.drawTree(c, x, y, tx * TILE, ty * TILE);
      }
    tex.refresh();
    const img = this.scene.add.image(cx * CHUNK_PX, cy * CHUNK_PX, key).setOrigin(0).setDepth(0);
    this.chunks.set(key, img);
  }

  private drawTile(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    const m = this.map;
    const i = m.idx(x, y);
    switch (m.type[i]) {
      case T.GRASS:
        return this.grass(c, x, y, ox, oy, m.flags[i]);
      case T.ROAD:
        return this.road(c, x, y, ox, oy);
      case T.SIDEWALK:
      case T.DRIVEWAY:
        return this.sidewalk(c, x, y, ox, oy, m.type[i] === T.DRIVEWAY);
      case T.BIKE:
        return this.bike(c, x, y, ox, oy);
      case T.BUILDING:
        return this.building(c, x, y, ox, oy);
      case T.LOT:
      case T.PARKING:
        return this.lot(c, x, y, ox, oy, m.type[i] === T.PARKING);
      case T.PATH:
        c.fillStyle = '#d6c79e';
        c.fillRect(ox, oy, TILE, TILE);
        this.specks(c, x, y, ox, oy, 'rgba(120,100,60,0.35)', 8);
        return;
      case T.WATER:
        return this.water(c, x, y, ox, oy);
    }
  }

  private specks(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, col: string, n: number): void {
    c.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const sx = hash2(x, y, k * 3 + 1) * (TILE - 2);
      const sy = hash2(x, y, k * 3 + 2) * (TILE - 2);
      c.fillRect(ox + sx, oy + sy, 2, 2);
    }
  }

  private grass(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, flags: number): void {
    if (flags & F.RURAL) {
      const p = hash2(Math.floor(x / 9), Math.floor(y / 7), 11);
      let col = '#79a64e';
      let rows: string | null = null;
      const nearRoad = CARDS.some((d) => this.map.isRoad(x + VEC[d][0], y + VEC[d][1]));
      if (!nearRoad) {
        if (p < 0.22) [col, rows] = ['#cdb75e', 'rgba(150,120,40,0.4)'];
        else if (p < 0.4) [col, rows] = ['#9db357', 'rgba(60,90,30,0.35)'];
        else if (p < 0.5) [col, rows] = ['#8a6a45', 'rgba(60,40,20,0.35)'];
      }
      c.fillStyle = col;
      c.fillRect(ox, oy, TILE, TILE);
      if (rows) {
        c.fillStyle = rows;
        for (let k = 2; k < TILE; k += 6) c.fillRect(ox, oy + k, TILE, 2);
      } else this.specks(c, x, y, ox, oy, 'rgba(40,80,20,0.35)', 5);
      return;
    }
    c.fillStyle = '#6d9e4a';
    c.fillRect(ox, oy, TILE, TILE);
    this.specks(c, x, y, ox, oy, 'rgba(40,80,20,0.4)', 6);
    this.specks(c, x + 99, y, ox, oy, 'rgba(160,210,110,0.35)', 4);
  }

  private drawTree(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    const m = this.map;
    const i = m.idx(x, y);
    if (m.type[i] !== T.GRASS) return;
    const inPark = x >= PARK.x && x < PARK.x + PARK.w && y >= PARK.y && y < PARK.y + PARK.h;
    const rural = (m.flags[i] & F.RURAL) !== 0;
    const nearRoad = CARDS.some((d) => m.typeAt(x + VEC[d][0], y + VEC[d][1]) === T.ROAD);
    const p = hash2(x, y, 3);
    const chance = inPark ? 0.13 : rural && !nearRoad ? 0.07 : 0;
    if (p >= chance) return;
    const r = 10 + hash2(x, y, 4) * 6;
    const cx = ox + 16 + (hash2(x, y, 5) - 0.5) * 8;
    const cy = oy + 16 + (hash2(x, y, 6) - 0.5) * 8;
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.arc(cx + 4, cy + 4, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2f6b2a';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4a8c3a';
    c.beginPath();
    c.arc(cx - r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
    c.fill();
  }

  private road(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    const m = this.map;
    const i = m.idx(x, y);
    const zone = m.zone[i];
    const flags = m.flags[i];
    const tunnel = (flags & F.TUNNEL) !== 0;
    let base = '#56575d';
    if (zone === Z.AUTOBAHN) base = '#4c4d53';
    if (zone === Z.SPIEL) base = '#a3927e';
    if (tunnel) base = '#3e3e44';
    c.fillStyle = base;
    c.fillRect(ox, oy, TILE, TILE);
    if (zone === Z.SPIEL) {
      c.fillStyle = 'rgba(0,0,0,0.13)';
      for (let r = 0; r < 4; r++) {
        c.fillRect(ox, oy + r * 8, TILE, 1);
        for (let k = (r % 2) * 8; k < TILE; k += 16) c.fillRect(ox + k, oy + r * 8, 1, 8);
      }
      return;
    }
    this.specks(c, x, y, ox, oy, 'rgba(0,0,0,0.18)', 5);
    this.specks(c, x + 50, y, ox, oy, 'rgba(255,255,255,0.06)', 4);
    if (m.region[i] >= 0) return;

    if (flags & F.CROSSWALK) {
      c.fillStyle = '#f2f2f2';
      const onH = m.crossAxis[i] === 1;
      if (flags & F.ZEBRA) {
        for (let k = 0; k < 2; k++) {
          if (onH) c.fillRect(ox + 3, oy + 3 + k * 16, TILE - 6, 9);
          else c.fillRect(ox + 3 + k * 16, oy + 3, 9, TILE - 6);
        }
      } else {
        for (let k = 0; k < TILE; k += 8) {
          if (onH) {
            c.fillRect(ox + 2, oy + k + 1, 3, 5);
            c.fillRect(ox + TILE - 5, oy + k + 1, 3, 5);
          } else {
            c.fillRect(ox + k + 1, oy + 2, 5, 3);
            c.fillRect(ox + k + 1, oy + TILE - 5, 5, 3);
          }
        }
      }
      return;
    }

    const mask = m.dir[i];
    const auto = zone === Z.AUTOBAHN;
    for (const d of CARDS) {
      const [dx, dy] = VEC[d];
      const nx = x + dx;
      const ny = y + dy;
      const ni = m.inb(nx, ny) ? m.idx(nx, ny) : -1;
      const nRoad = ni >= 0 && m.type[ni] === T.ROAD;
      // Lane separators only across the lane axis.
      const sepAxis = axisOf(d) === 'h' ? 'v' : 'h';
      const laneAxis = mask & (BIT.E | BIT.W) ? 'h' : 'v';
      if (nRoad && m.region[ni] < 0 && !(m.flags[ni] & F.CROSSWALK) && sepAxis === laneAxis) {
        const nm = m.dir[ni];
        const opp = nm !== mask;
        c.fillStyle = opp && auto ? '#f0e6b0' : '#eeeeee';
        if (opp && auto) {
          this.edgeLine(c, ox, oy, d, 3, 1.6, false);
        } else if (opp) {
          this.edgeLine(c, ox, oy, d, 0, 1.6, true, 6, 26);
        } else {
          this.edgeLine(c, ox, oy, d, 0, 1.3, true, 10, 22);
        }
      } else if (!nRoad && (zone === Z.AUTOBAHN || zone === Z.LAND)) {
        c.fillStyle = '#e8e8e8';
        this.edgeLine(c, ox, oy, d, 3, 2, false);
      }
    }
    const sl = this.stopLines.get(i);
    if (sl) {
      c.fillStyle = '#f5f5f5';
      this.edgeLine(c, ox, oy, sl, 1, 4, false);
    }
    if (tunnel) {
      c.fillStyle = 'rgba(255,190,60,0.5)';
      if (hash2(x, 0, 2) < 0.5 && !m.isRoad(x, y - 1)) c.fillRect(ox + 10, oy + 1, 12, 2);
    }
  }

  /** Draw a line along one edge of the tile (in the tile's own half). */
  private edgeLine(
    c: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    d: Card,
    inset: number,
    w: number,
    dashed: boolean,
    a = 0,
    b = TILE,
  ): void {
    const from = dashed ? a : 0;
    const len = dashed ? b - a : TILE;
    switch (d) {
      case 'E':
        c.fillRect(ox + TILE - inset - w, oy + from, w, len);
        break;
      case 'W':
        c.fillRect(ox + inset, oy + from, w, len);
        break;
      case 'S':
        c.fillRect(ox + from, oy + TILE - inset - w, len, w);
        break;
      case 'N':
        c.fillRect(ox + from, oy + inset, len, w);
        break;
    }
  }

  private sidewalk(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, driveway: boolean): void {
    c.fillStyle = driveway ? '#aea89b' : '#bdb8ad';
    c.fillRect(ox, oy, TILE, TILE);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(ox, oy + 15, TILE, 1);
    c.fillRect(ox + 15 + ((y % 2) * 8 - 4), oy, 1, TILE);
    c.fillRect(ox, oy, TILE, 1);
    for (const d of CARDS) {
      const t = this.map.typeAt(x + VEC[d][0], y + VEC[d][1]);
      if (t === T.ROAD) {
        c.fillStyle = driveway ? '#9d978a' : '#8b877d';
        this.edgeLine(c, ox, oy, d, 0, driveway ? 1.5 : 3, false);
      }
    }
    if (driveway) {
      c.fillStyle = 'rgba(0,0,0,0.07)';
      for (let k = 4; k < TILE; k += 8) c.fillRect(ox + k, oy + 4, 2, TILE - 8);
    }
  }

  private bike(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    c.fillStyle = '#b5574b';
    c.fillRect(ox, oy, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (const d of CARDS) {
      const t = this.map.typeAt(x + VEC[d][0], y + VEC[d][1]);
      if (t === T.SIDEWALK) this.edgeLine(c, ox, oy, d, 1, 1.5, true, 4, 28);
    }
    if ((x + y) % 4 === 0) {
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(ox + 10, oy + 17, 4, 0, Math.PI * 2);
      c.moveTo(ox + 26, oy + 17);
      c.arc(ox + 22, oy + 17, 4, 0, Math.PI * 2);
      c.moveTo(ox + 10, oy + 17);
      c.lineTo(ox + 15, oy + 11);
      c.lineTo(ox + 22, oy + 17);
      c.stroke();
    }
  }

  private building(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    const m = this.map;
    const lot = m.lot[m.idx(x, y)];
    let col: string;
    if (lot > 0 && lot < 100000) col = m.pois[lot - 1].color;
    else col = ROOFS[Math.floor(hash2(lot, lot >> 3, 9) * ROOFS.length)];
    c.fillStyle = col;
    c.fillRect(ox, oy, TILE, TILE);
    // Roof texture.
    c.fillStyle = 'rgba(0,0,0,0.06)';
    for (let k = 0; k < TILE; k += 4) c.fillRect(ox, oy + k, TILE, 1);
    for (const d of CARDS) {
      const nx = x + VEC[d][0];
      const ny = y + VEC[d][1];
      const same = m.typeAt(nx, ny) === T.BUILDING && m.inb(nx, ny) && m.lot[m.idx(nx, ny)] === lot;
      if (!same) {
        c.fillStyle = shade(col.startsWith('#') ? col : '#888888', -45);
        this.edgeLine(c, ox, oy, d, 0, 3, false);
        c.fillStyle = 'rgba(255,255,255,0.12)';
        this.edgeLine(c, ox, oy, d, 3, 1.5, false);
      }
    }
    if (lot >= 100000 && hash2(x, y, 21) < 0.12) {
      c.fillStyle = 'rgba(40,40,40,0.45)';
      c.fillRect(ox + 9, oy + 9, 10, 8);
      c.fillStyle = 'rgba(200,200,200,0.35)';
      c.fillRect(ox + 10, oy + 10, 8, 2);
    }
  }

  private lot(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number, bay: boolean): void {
    c.fillStyle = '#636469';
    c.fillRect(ox, oy, TILE, TILE);
    this.specks(c, x, y, ox, oy, 'rgba(0,0,0,0.15)', 4);
    if (!bay) return;
    c.fillStyle = '#f0f0f0';
    c.fillRect(ox, oy, 2, TILE);
    c.fillRect(ox + TILE - 2, oy, 2, TILE);
    const m = this.map;
    for (const d of ['N', 'S'] as Card[]) {
      const t = m.typeAt(x, y + VEC[d][1]);
      if (t !== T.LOT) {
        this.edgeLine(c, ox, oy, d, 0, 2, false);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillText('P', ox + 16, oy + (d === 'N' ? 14 : 26));
        c.fillStyle = '#f0f0f0';
      }
    }
  }

  private water(c: CanvasRenderingContext2D, x: number, y: number, ox: number, oy: number): void {
    c.fillStyle = '#3f86c9';
    c.fillRect(ox, oy, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(ox + 6 + hash2(x, y, 1) * 10, oy + 8, 8, 2);
    c.fillRect(ox + 4 + hash2(x, y, 2) * 14, oy + 20, 10, 2);
    for (const d of CARDS) {
      if (this.map.typeAt(x + VEC[d][0], y + VEC[d][1]) !== T.WATER) {
        c.fillStyle = '#a7a39b';
        this.edgeLine(c, ox, oy, d, 0, 5, false);
      }
    }
    const allWater = CARDS.every((d) => this.map.typeAt(x + VEC[d][0], y + VEC[d][1]) === T.WATER);
    if (allWater) {
      c.fillStyle = '#d8ecff';
      c.beginPath();
      c.arc(ox + 16, oy + 16, 6, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** 1 px per tile overview used by the HUD minimap. */
  static drawMinimap(scene: Phaser.Scene, map: MapData, key: string): void {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, map.w, map.h);
    if (!tex) return;
    const c = tex.getContext();
    const img = c.createImageData(map.w, map.h);
    const col = (t: number, z: number, f: number): [number, number, number] => {
      switch (t) {
        case T.ROAD:
          return z === Z.AUTOBAHN ? [230, 200, 90] : z === Z.SPIEL ? [190, 160, 130] : [210, 210, 215];
        case T.SIDEWALK:
        case T.DRIVEWAY:
          return [110, 108, 104];
        case T.BIKE:
          return [170, 80, 70];
        case T.BUILDING:
          return [62, 58, 56];
        case T.LOT:
        case T.PARKING:
          return [120, 140, 190];
        case T.PATH:
          return [170, 160, 120];
        case T.WATER:
          return [70, 130, 200];
        default:
          return f & F.RURAL ? [70, 100, 50] : [80, 120, 60];
      }
    };
    for (let i = 0; i < map.n; i++) {
      const [r, g, b] = col(map.type[i], map.zone[i], map.flags[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    tex.refresh();
  }
}
