import { CONTAINERS, WERTSTOFF_PLAZA } from '../world/cityLayout';
import { area, bayOf, doorPos, lotArea, parkIn } from './helpers';
import type { Mission } from './types';

const ORDER = ['Altpapier', 'Gelber Sack', 'Bioabfall', 'Grünglas'];

export const m3: Mission = {
  id: 3,
  title: 'Mülltrennung',
  letter: {
    from: 'Abfallwirtschaftsbetrieb Bad Regelsheim (AWB)',
    subject: 'Your Restmülltonne was not emptied',
    body: [
      'Sehr geehrte/r Abfallbesitzer/in,',
      'during a routine inspection our staff found an aluminium yoghurt lid in your Restmüll. Your bin has been sealed.',
      'Our inspector has kindly pre-sorted your waste into four bags. Take them to the Wertstoffinsel on the Schulstraße (west) and dispose of them in exactly this order: 1. Altpapier, 2. Gelber Sack, 3. Bioabfall, 4. Grünglas.',
      'Glass containers may only be used Mo–Sa from 08:00 to 13:00 and from 15:00 to 19:00 (Mittagsruhe!). Press Z to wait like a responsible citizen.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 1, h: 12, m: 15 });
    ctx.emit({ type: 'place', mode: 'foot', player: doorPos('home'), car: bayOf('home', 1), disc: true });
    ctx.flags.items = [...ORDER];
  },
  objectives: [
    parkIn('Drive your four bags to the Wertstoffinsel (Schulstraße, west) and park there.', lotArea('wertstoff')),
    {
      text: (ctx) => {
        const items: string[] = ctx.flags.items;
        return `Dispose of: ${items[0]} — stand in front of the right container and press SPACE. (${items.length} bag${items.length === 1 ? '' : 's'} left${ctx.clock.glassAllowed ? '' : ', glass: Ruhezeit!'})`;
      },
      target: area(WERTSTOFF_PLAZA.x, WERTSTOFF_PLAZA.y + 2, WERTSTOFF_PLAZA.w, 1),
      update: (s, ctx) => {
        const items: string[] = ctx.flags.items;
        if (!s.interact || s.mode !== 'foot') return items.length === 0;
        const c = CONTAINERS.find((k) => Math.abs(s.px - (k.x + 0.5)) < 0.9 && Math.abs(s.py - (k.y + 0.5)) < 1.7);
        if (!c) {
          ctx.emit({ type: 'toast', text: 'There is no container here. Stand right in front of one.' });
          return false;
        }
        if (c.accepts !== items[0]) {
          ctx.emit({ type: 'fine', id: 'wrong_bin', detail: `${items[0]} does not belong in "${c.label}"` });
          return false;
        }
        if (c.label.endsWith('glas') && !ctx.clock.glassAllowed) {
          ctx.emit({ type: 'fine', id: 'glass_quiet', detail: `Glass dropped at ${ctx.clock.format()}` });
          return false;
        }
        items.shift();
        ctx.emit({ type: 'sfx', name: 'ok' });
        ctx.emit({ type: 'toast', text: `Properly disposed of (ordnungsgemäß entsorgt): ${c.accepts} ✔` });
        return items.length === 0;
      },
    },
  ],
  pay: 350,
  payLabel: 'Wertstoff-Bonus',
  completeNote: () => ['Your Restmülltonne has been unsealed. A follow-up inspection is scheduled. Surprise!'],
};
