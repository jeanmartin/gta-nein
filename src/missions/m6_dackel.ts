import { FOUNTAIN_RING } from '../world/cityLayout';
import { area, bayOf, doorArea, doorPos, reach } from './helpers';
import type { Mission } from './types';

interface Poop {
  id: number;
  x: number;
  y: number;
  age: number;
}

export const m6: Mission = {
  id: 6,
  title: 'Dackel Gassi',
  letter: {
    from: 'Der Bürgermeister von Bad Regelsheim',
    subject: 'Compulsory volunteer work: dog walking (Pflichtehrenamt)',
    body: [
      'Sehr geehrte/r Mitbürger/in,',
      'you have been chosen by lottery for the compulsory volunteer post of "walking the Mayor\'s dog".',
      'Waldi (wire-haired dachshund, 11) needs his walk to the fountain in the Stadtpark and back to the Rathaus.',
      'Dog mess must be removed IMMEDIATELY (stand next to it and press SPACE). Humans may not step on the lawns. Waldi may, because he is a dog.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 3, h: 16, m: 0 });
    ctx.emit({ type: 'place', mode: 'foot', player: doorPos('rathaus'), car: bayOf('home', 1), disc: true });
    ctx.emit({ type: 'dog', on: true });
    ctx.flags.poops = [] as Poop[];
    ctx.flags.walked = 0;
    ctx.flags.nextPoop = 9;
    ctx.flags.poopId = 0;
    ctx.flags.lastDog = null;
  },
  tick(s, ctx, dt) {
    if (s.dogX === null || s.dogY === null) return;
    const last = ctx.flags.lastDog as { x: number; y: number } | null;
    if (last) ctx.flags.walked += Math.hypot(s.dogX - last.x, s.dogY - last.y);
    ctx.flags.lastDog = { x: s.dogX, y: s.dogY };
    const poops = ctx.flags.poops as Poop[];
    if (ctx.flags.walked >= ctx.flags.nextPoop) {
      ctx.flags.nextPoop += 16 + Math.random() * 10;
      const p = { id: ++ctx.flags.poopId, x: s.dogX, y: s.dogY, age: 0 };
      poops.push(p);
      ctx.emit({ type: 'poop', id: p.id, x: p.x, y: p.y });
      ctx.emit({ type: 'toast', text: 'Waldi has done his business. Pick it up (SPACE) before the Ordnungsamt sees it!' });
    }
    for (const p of [...poops]) {
      p.age += dt;
      const near = Math.hypot(s.px - p.x, s.py - p.y) < 1.4;
      if (s.interact && near) {
        ctx.emit({ type: 'poopGone', id: p.id });
        ctx.emit({ type: 'sfx', name: 'ok' });
        ctx.emit({ type: 'toast', text: 'Bag in, bag closed, into the bin. Vorbildlich! ✔' });
        poops.splice(poops.indexOf(p), 1);
      } else if (p.age > 15) {
        ctx.emit({ type: 'poopGone', id: p.id });
        ctx.emit({ type: 'fine', id: 'dog_poop' });
        poops.splice(poops.indexOf(p), 1);
      }
    }
  },
  objectives: [
    reach(
      'Walk Waldi to the fountain in the Stadtpark. Stay on the paths. Rasen betreten verboten!',
      area(FOUNTAIN_RING.x, FOUNTAIN_RING.y, FOUNTAIN_RING.w, FOUNTAIN_RING.h),
      'foot',
    ),
    reach('Walk Waldi back to the Rathaus.', doorArea('rathaus'), 'foot'),
  ],
  pay: 500,
  payLabel: 'Ehrenamtspauschale (taxable above €840/year)',
  completeNote: (ctx) => {
    ctx.emit({ type: 'dog', on: false });
    for (const p of ctx.flags.poops as Poop[]) ctx.emit({ type: 'poopGone', id: p.id });
    return ['The Mayor thanks you. Waldi does not. He has already bitten the Stadtkämmerer.'];
  },
};
