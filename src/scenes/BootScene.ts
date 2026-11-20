import Phaser from 'phaser';
import { CONTAINERS } from '../world/cityLayout';

type Draw = (c: CanvasRenderingContext2D) => void;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Top-down car pointing east (+x). */
function drawCar(c: CanvasRenderingContext2D, w: number, h: number, body: string, opts: { roof?: string; bar?: string; stripe?: string; kombi?: boolean } = {}): void {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(c, 2, 3, w - 2, h - 3, 4);
  c.fill();
  c.fillStyle = body;
  roundRect(c, 1, 1, w - 3, h - 4, 4);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 1;
  c.stroke();
  // Windscreen and rear window.
  c.fillStyle = '#1d2733';
  c.fillRect(w * 0.58, 3, w * 0.13, h - 8);
  c.fillRect(w * (opts.kombi ? 0.1 : 0.16), 3.5, w * 0.1, h - 9);
  // Roof.
  c.fillStyle = opts.roof ?? shade(body, -12);
  c.fillRect(w * (opts.kombi ? 0.2 : 0.27), 3, w * (opts.kombi ? 0.38 : 0.31), h - 8);
  if (opts.stripe) {
    c.fillStyle = opts.stripe;
    c.fillRect(2, (h - 4) / 2 - 1.5, w - 4, 3);
  }
  if (opts.bar) {
    c.fillStyle = opts.bar;
    c.fillRect(w * 0.42, 3, 3, h - 8);
  }
  // Headlights and tail lights.
  c.fillStyle = '#fff8c0';
  c.fillRect(w - 4, 3, 2, 3);
  c.fillRect(w - 4, h - 8, 2, 3);
  c.fillStyle = '#c0261d';
  c.fillRect(1, 3, 2, 3);
  c.fillRect(1, h - 8, 2, 3);
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawPerson(c: CanvasRenderingContext2D, s: number, body: string, head: string): void {
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(s / 2 + 1, s / 2 + 1, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(s / 2, s / 2, s * 0.42, s * 0.28, Math.PI / 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = head;
  c.beginPath();
  c.arc(s / 2 + 1, s / 2, s * 0.2, 0, Math.PI * 2);
  c.fill();
}

export const NPC_CAR_COLORS = ['#c0392b', '#2c3e50', '#7f8c8d', '#ecf0f1', '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#16a085', '#34495e', '#bdc3c7', '#f1c40f'];
export const PED_COLORS = ['#3b5b92', '#7a3b3b', '#556b2f', '#6b4f8a', '#8a6d3b', '#2f4f4f', '#a0522d', '#4a4a4a'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // Cars (32×18 incl. shadow; pointing east).
    tex(this, 'car_player', 32, 19, (c) => drawCar(c, 32, 19, '#d8cfb4', { kombi: true, roof: '#b9b096' }));
    NPC_CAR_COLORS.forEach((col, i) => tex(this, `car_${i}`, 30, 18, (c) => drawCar(c, 30, 18, col)));
    tex(this, 'truck', 50, 21, (c) => {
      drawCar(c, 50, 21, '#e0e0e0', { roof: '#f2f2f2' });
      c.fillStyle = '#3a6ea5';
      c.fillRect(36, 2, 11, 14);
      c.fillStyle = '#ddd';
      c.fillRect(3, 2, 31, 15);
      c.fillStyle = '#888';
      c.font = 'bold 7px sans-serif';
      c.fillText('SPEDITION', 5, 12);
    });
    tex(this, 'police', 32, 19, (c) => drawCar(c, 32, 19, '#e9ecef', { stripe: '#1e5bb8', bar: '#3a7bff' }));
    tex(this, 'ambulance', 38, 21, (c) => drawCar(c, 38, 21, '#f8f8f8', { stripe: '#d9271d', bar: '#3a7bff', roof: '#ffffff' }));
    tex(this, 'van_black', 38, 21, (c) => drawCar(c, 38, 21, '#16181c', { roof: '#22252b' }));
    tex(this, 'ordnungsamt', 34, 19, (c) => drawCar(c, 34, 19, '#f4f4f4', { stripe: '#e3a21a', bar: '#e3a21a' }));

    // People.
    PED_COLORS.forEach((col, i) => tex(this, `ped_${i}`, 14, 14, (c) => drawPerson(c, 14, col, '#e8c39e')));
    tex(this, 'child', 10, 10, (c) => drawPerson(c, 10, '#e74c3c', '#f1d1b0'));
    tex(this, 'player_foot', 16, 16, (c) => {
      drawPerson(c, 16, '#c9b48a', '#f0c8a0');
      c.fillStyle = '#5a4a2a';
      c.beginPath();
      c.arc(9, 8, 3.2, 0, Math.PI * 2);
      c.fill(); // hat
    });
    tex(this, 'dog', 22, 10, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(3, 4, 16, 5);
      c.fillStyle = '#7a4a21';
      roundRect(c, 3, 2, 14, 6, 3);
      c.fill();
      c.beginPath();
      c.ellipse(18, 5, 3.5, 2.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4d2c10';
      c.fillRect(16, 1, 2, 3);
      c.fillRect(16, 6, 2, 3);
      c.fillRect(0, 4, 4, 2);
    });
    tex(this, 'poop', 10, 10, (c) => {
      c.fillStyle = '#5b3a1a';
      c.beginPath();
      c.arc(5, 6, 3.5, 0, Math.PI * 2);
      c.arc(5, 3.5, 2.3, 0, Math.PI * 2);
      c.fill();
    });

    // Street furniture.
    tex(this, 'blitzer', 16, 16, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(4, 4, 11, 11);
      c.fillStyle = '#6d7175';
      c.fillRect(2, 2, 11, 11);
      c.fillStyle = '#d6d6d6';
      c.fillRect(3, 3, 9, 4);
      c.fillStyle = '#111';
      c.beginPath();
      c.arc(7.5, 9, 2.5, 0, Math.PI * 2);
      c.fill();
    });
    tex(this, 'rentner', 22, 16, (c) => {
      c.fillStyle = '#d9d2c3';
      c.fillRect(0, 0, 22, 16);
      c.fillStyle = '#7fa7c9';
      c.fillRect(2, 2, 18, 10);
      c.fillStyle = '#e9e9e9';
      c.beginPath();
      c.arc(11, 7, 4.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f0c8a0';
      c.beginPath();
      c.arc(11, 7.5, 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#b54848';
      c.fillRect(1, 11, 20, 4); // Fensterkissen
      c.strokeStyle = '#fff';
      c.strokeRect(1.5, 1.5, 19, 11);
    });
    for (const [key, cols] of [
      ['tl_red', ['#ff2a1a', '#3a2a10', '#103a10']],
      ['tl_redamber', ['#ff2a1a', '#ffb700', '#103a10']],
      ['tl_amber', ['#3a1010', '#ffb700', '#103a10']],
      ['tl_green', ['#3a1010', '#3a2a10', '#22e04a']],
    ] as const) {
      tex(this, key, 10, 24, (c) => {
        c.fillStyle = '#1b1b1b';
        roundRect(c, 0, 0, 10, 24, 3);
        c.fill();
        cols.forEach((col, i) => {
          c.fillStyle = col;
          c.beginPath();
          c.arc(5, 4.5 + i * 7.5, 3, 0, Math.PI * 2);
          c.fill();
        });
      });
    }
    for (const [key, col] of [
      ['ped_red', '#ff3322'],
      ['ped_green', '#33ee55'],
    ] as const) {
      tex(this, key, 10, 12, (c) => {
        c.fillStyle = '#1b1b1b';
        roundRect(c, 0, 0, 10, 12, 2);
        c.fill();
        c.fillStyle = col;
        // A tiny Ampelmännchen with a hat.
        c.fillRect(4, 3, 2, 5);
        c.fillRect(3, 2, 4, 1);
        if (key === 'ped_red') c.fillRect(2, 4, 6, 1);
        else {
          c.fillRect(2, 8, 1, 2);
          c.fillRect(7, 8, 1, 2);
        }
      });
    }

    // Signs (top-down: small discs/squares).
    const limitSign = (key: string, text: string, ring = '#d41b1b', bg = '#ffffff', fg = '#111') =>
      tex(this, key, 22, 22, (c) => {
        c.fillStyle = bg;
        c.beginPath();
        c.arc(11, 11, 10, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = ring;
        c.stroke();
        c.fillStyle = fg;
        c.font = `bold ${text.length > 2 ? 8 : 10}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, 11, 11.5);
      });
    for (const v of [7, 10, 30, 50, 100]) limitSign(`sign_${v}`, String(v));
    tex(this, 'sign_stop', 22, 22, (c) => {
      c.fillStyle = '#d41b1b';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + Math.PI / 8;
        c.lineTo(11 + Math.cos(a) * 10.5, 11 + Math.sin(a) * 10.5);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 7px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('STOP', 11, 11.5);
    });
    tex(this, 'sign_autobahn', 24, 22, (c) => {
      c.fillStyle = '#1d4fa3';
      roundRect(c, 0, 0, 24, 22, 3);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(6, 20);
      c.lineTo(10, 6);
      c.moveTo(18, 20);
      c.lineTo(14, 6);
      c.moveTo(4, 9);
      c.quadraticCurveTo(12, 3, 20, 9);
      c.stroke();
    });
    tex(this, 'sign_spiel', 24, 22, (c) => {
      c.fillStyle = '#1d4fa3';
      roundRect(c, 0, 0, 24, 22, 3);
      c.fill();
      c.fillStyle = '#fff';
      c.fillRect(3, 13, 7, 5); // house
      c.beginPath();
      c.moveTo(2, 13);
      c.lineTo(6.5, 9);
      c.lineTo(11, 13);
      c.fill();
      c.beginPath();
      c.arc(17, 8, 2, 0, Math.PI * 2);
      c.fill(); // kid
      c.fillRect(16, 10, 2, 6);
      c.beginPath();
      c.arc(20, 17, 2, 0, Math.PI * 2);
      c.fill(); // ball
    });

    // Recycling containers.
    for (const k of CONTAINERS) {
      tex(this, `container_${k.label}`, 30, 26, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(4, 5, 26, 21);
        c.fillStyle = k.color;
        roundRect(c, 1, 1, 26, 21, 3);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(8, 4, 12, 3);
        c.fillStyle = k.color === '#e8e8e8' || k.color === '#e3c62b' ? '#222' : '#fff';
        c.font = 'bold 6px sans-serif';
        c.textAlign = 'center';
        c.fillText(k.label.toUpperCase(), 14, 16);
      });
    }

    // Effects.
    tex(this, 'arrow', 28, 28, (c) => {
      c.fillStyle = '#ffd400';
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(26, 14);
      c.lineTo(6, 3);
      c.lineTo(11, 14);
      c.lineTo(6, 25);
      c.closePath();
      c.fill();
      c.stroke();
    });
    // Headlight beam, pointing east from its left-middle origin. Feathered so it can
    // be used both to erase darkness and as an additive warm tint.
    tex(this, 'headlight', 340, 220, (c) => {
      c.filter = 'blur(7px)';
      for (const off of [-6, 6]) {
        const g = c.createRadialGradient(4, 110 + off, 4, 4, 110 + off, 330);
        g.addColorStop(0, 'rgba(255,248,215,1)');
        g.addColorStop(0.35, 'rgba(255,248,215,0.75)');
        g.addColorStop(1, 'rgba(255,248,215,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(8, 104 + off);
        c.lineTo(330, 28 + off);
        c.lineTo(330, 192 + off);
        c.lineTo(8, 116 + off);
        c.closePath();
        c.fill();
      }
      c.filter = 'none';
    });
    tex(this, 'glow', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,220,150,0.7)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    tex(this, 'blue_glow', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(80,140,255,0.9)');
      g.addColorStop(1, 'rgba(80,140,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
    tex(this, 'pixel', 4, 4, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 4, 4);
    });

    this.scene.start('Title');
  }
}
