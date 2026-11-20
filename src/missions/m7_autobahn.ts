import { area, bayOf, lotArea, parkIn, reach } from './helpers';
import type { Mission } from './types';

export const m7: Mission = {
  id: 7,
  title: 'Autobahn',
  letter: {
    from: 'Landesamt für Formularwesen, Abt. IV/7b',
    subject: 'Personal delivery of file Az. FW-4711/b',
    body: [
      'Sehr geehrte/r Bürger/in,',
      'the enclosed file must be delivered in person, because our fax machine is being repaired (since 2009).',
      'Take the Westring north onto the A 99½. There is no general speed limit, but a recommended speed of 130 km/h and a MINIMUM of 60 km/h. Overtake on the LEFT only.',
      'If you hear a siren, form a Rettungsgasse (emergency lane): move to the outer edge of your lane. In the left lane go far left, in the right lane go far right.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 4, h: 10, m: 0 });
    ctx.emit({ type: 'place', mode: 'car', car: bayOf('finanzamt', 2), disc: false });
    ctx.flags.amb = false;
  },
  tick(s, ctx, _dt, obj) {
    if (!ctx.flags.amb && obj >= 1 && s.mode === 'car' && s.py < 8.5 && s.px > 60 && s.px < 160) {
      ctx.flags.amb = true;
      ctx.emit({ type: 'ambulance' });
      ctx.emit({ type: 'banner', text: 'TATÜ-TATA!', sub: 'Emergency vehicle behind you: form a Rettungsgasse!' });
    }
  },
  objectives: [
    reach('Take the Westring north onto the A 99½ (heading east).', area(12, 6, 30, 2), 'car'),
    reach(
      'Follow the A 99½ east, then south. Minimum 60 km/h. Overtake on the LEFT only.',
      area(190, 30, 2, 20),
      'car',
    ),
    parkIn('Exit west onto the Ringstraße and park at the Landesamt für Formularwesen.', lotArea('landesamt')),
    reach('Deliver the file to the Landesamt entrance.', area(152, 86, 1, 3), 'foot'),
  ],
  pay: 800,
  payLabel: 'Reisekostenerstattung (travel costs, as per BRKG)',
  completeNote: () => ['File received. It will now be faxed back to you. Once the fax machine works again.'],
};
