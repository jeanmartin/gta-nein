import { HM, bayOf, doorArea, inArea, lotArea, parkIn } from './helpers';
import type { Mission } from './types';

const OPEN = HM(13, 55);
const CLOSE = HM(14, 5);

export const m5: Mission = {
  id: 5,
  title: 'TÜV-Termin',
  letter: {
    from: 'TÜV Bad Regelsheim · Hauptuntersuchung',
    subject: 'Appointment confirmation: Wednesday, 14:00',
    body: [
      'Sehr geehrte/r Fahrzeughalter/in,',
      'your vehicle is due for its Hauptuntersuchung. Your appointment is today at 14:00.',
      'Please be at our entrance on time. Arriving early disrupts our processes and will be fined (§ 1 TerminVO). Arriving late cancels your appointment. The time window is 13:55–14:05.',
      'Press Z to wait. Waiting is a skill. Practise it.',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 2, h: 13, m: 20 });
    ctx.emit({ type: 'place', mode: 'car', car: bayOf('home', 2), disc: false });
    ctx.flags.inside = false;
  },
  objectives: [
    parkIn('Drive to the TÜV (Hauptstraße, east) and park.', lotArea('tuev'), CLOSE),
    {
      text: (ctx) =>
        `Be at the TÜV entrance at 14:00 sharp (13:55–14:05). It is ${ctx.clock.format().slice(3)}. Not earlier! (Z = wait)`,
      target: doorArea('tuev'),
      deadline: CLOSE,
      update: (s, ctx) => {
        const here = s.mode === 'foot' && inArea(s.px, s.py, doorArea('tuev'));
        if (!here) {
          ctx.flags.inside = false;
          return false;
        }
        if (ctx.clock.minutes < OPEN) {
          if (!ctx.flags.inside) {
            ctx.emit({ type: 'fine', id: 'early', detail: `Arrived at ${ctx.clock.format().slice(3)}` });
            ctx.emit({ type: 'toast', text: 'Too early! Please leave the entrance and wait outside.' });
          }
          ctx.flags.inside = true;
          return false;
        }
        return true;
      },
    },
  ],
  pay: 400,
  payLabel: 'Pendlerpauschale (commuter allowance)',
  fee: { amount: 140, label: 'TÜV-Prüfgebühr (Hauptuntersuchung)' },
  completeNote: (ctx) => [
    'Inspection report: brakes OK. Lights OK. Driver: suspicious.',
    `Brake fluid consumed so far: ${ctx.bureau.brakeFluidL.toFixed(2)} litres. As required by § 93 AO, this figure has been sent to the Finanzamt.`,
  ],
  failText: 'You missed your appointment. The next free appointment is in 6–8 months. Or, because this is a game, right now.',
};
