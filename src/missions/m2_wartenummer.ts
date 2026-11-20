import { bayOf, doorArea, doorPos, inArea, reach } from './helpers';
import type { Mission } from './types';

export const m2: Mission = {
  id: 2,
  title: 'Wartenummer 4711',
  letter: {
    from: 'Stadt Bad Regelsheim · Bürgeramt, Schalter 3',
    subject: 'Your application requires Formular KfZ-17b',
    body: [
      'Sehr geehrte/r Antragsteller/in,',
      'to finish your registration we need Formular KfZ-17b, with a stamp from Zimmer B 3.14 (Ordnungsamt, across the street) and a certification from the Kfz-Zulassungsstelle (Schulstraße, east).',
      'First, please draw a waiting number and wait in front of the entrance until your number is called. You may press Z to wait more efficiently.',
      'Crossing the Bahnhofstraße outside a crosswalk is strictly forbidden. The nearest traffic lights are at the Goethestraße and the Marktstraße.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 0, h: 10, m: 0 });
    const b = bayOf('buergeramt', 1);
    ctx.emit({ type: 'place', mode: 'foot', player: doorPos('buergeramt'), car: b, disc: true });
    ctx.flags.waited = 0;
  },
  objectives: [
    {
      text: (ctx) =>
        `Wait at the Bürgeramt entrance. Ihre Nummer: 4711 · Aktuelle Nummer: ${4700 + Math.min(11, Math.floor(ctx.flags.waited ?? 0))}  (Z = wait)`,
      target: doorArea('buergeramt'),
      update: (s, ctx) => {
        if (s.mode === 'foot' && inArea(s.px, s.py, doorArea('buergeramt'))) ctx.flags.waited += s.gameDt;
        if (ctx.flags.waited >= 11) {
          ctx.emit({ type: 'sfx', name: 'ok' });
          ctx.emit({ type: 'banner', text: 'Nummer 4711, bitte!', sub: 'Your number has been called.' });
          return true;
        }
        return false;
      },
    },
    reach(
      'Get a stamp from Zimmer B 3.14 at the Ordnungsamt across the street. Use a proper crossing!',
      doorArea('ordnungsamt'),
      'foot',
    ),
    reach(
      'Zimmer B 3.14: "The form must be certified by the Kfz-Zulassungsstelle FIRST." Drive to the Schulstraße (east).',
      doorArea('zulassung'),
      'foot',
    ),
    reach('Bring the certified, stamped Formular KfZ-17b back to the Bürgeramt.', doorArea('buergeramt'), 'foot'),
  ],
  pay: 300,
  payLabel: 'Fahrtkostenpauschale (travel allowance)',
  fee: { amount: 35, label: 'Verwaltungsgebühr Formular KfZ-17b' },
  completeNote: () => ['Your application has been received. Processing time: 6–8 weeks. Please do not ask about it.'],
};
