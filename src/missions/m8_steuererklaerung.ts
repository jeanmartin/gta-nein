import { HM, bayOf, doorArea, interactAt, reach } from './helpers';
import type { Mission } from './types';

const DEADLINE = HM(23, 59);

export const m8: Mission = {
  id: 8,
  title: 'Steuererklärung',
  letter: {
    from: 'Finanzamt Bad Regelsheim',
    subject: 'REMINDER: Income tax return due TODAY at 23:59',
    body: [
      'Sehr geehrte/r Steuerpflichtige/r,',
      'we have not yet received your income tax return. The deadline is TODAY at 23:59.',
      'Collect your Lohnsteuerbescheinigung (wage tax certificate) at the Bahnhof and your Spendenquittung (donation receipt) at the church, then put your return into the Finanzamt letterbox.',
      'It is dark: headlights on (L). Nachtruhe starts at 22:00. ELSTER is down for maintenance. Of course it is.',
      'Late filing costs a Verspätungszuschlag of at least €25, plus our deep disappointment.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 4, h: 21, m: 0 });
    ctx.emit({ type: 'place', mode: 'car', car: bayOf('home', 1), disc: false });
  },
  objectives: [
    reach('Collect your Lohnsteuerbescheinigung at the Bahnhof (Bahnhofstraße, east).', doorArea('bahnhof'), 'foot', DEADLINE),
    reach('Get the Spendenquittung from the church (Schulstraße).', doorArea('kirche'), 'foot', DEADLINE),
    interactAt('Put the Steuererklärung into the Finanzamt letterbox (SPACE) before 23:59!', doorArea('finanzamt'), DEADLINE),
  ],
  pay: 0,
  payLabel: '',
  final: true,
  failText:
    'Deadline missed. A Verspätungszuschlag has been applied. Out of pure mercy you are granted one more attempt (Wiedereinsetzung in den vorigen Stand).',
};
