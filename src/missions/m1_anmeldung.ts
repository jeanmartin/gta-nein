import { bayOf, doorArea, inArea, lotArea, parkIn, reach } from './helpers';
import type { Mission } from './types';

export const m1: Mission = {
  id: 1,
  title: 'Anmeldung',
  letter: {
    from: 'Stadt Bad Regelsheim · Bürgeramt',
    subject: 'Request to register your residence (Aufforderung zur Anmeldung)',
    body: [
      'Sehr geehrte Bürgerin, sehr geehrter Bürger,',
      'our records show that you moved to Bad Regelsheim 13 days ago. § 17 BMG gives you 14 days to register. Tomorrow you would be a criminal.',
      'You are therefore ordered to drive to the Bürgeramt on the Bahnhofstraße TODAY and register.',
      'Please note: your car now has a mandatory Bürgerfahrtenschreiber (citizen trip recorder). It reports every violation to the Ordnungsamt in real time, and fines are taken from your account automatically. How convenient!',
      'DRIVE: W/A/S/D or arrows · B seatbelt · Q/E indicator left/right · SPACE handbrake · L lights · H horn (please don\'t) · P Parkscheibe · F get in/out · Z wait · ESC pause',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 0, h: 7, m: 50 });
    ctx.emit({ type: 'place', mode: 'car', car: bayOf('home', 1), disc: false });
  },
  objectives: [
    {
      text: 'Anschnallen! Press B to fasten your seatbelt BEFORE you move.',
      update: (s) => s.mode === 'car' && s.belt,
    },
    {
      text: 'Drive to the Bürgeramt on the Bahnhofstraße. Indicate (Q / E) before every turn.',
      target: lotArea('buergeramt'),
      update: (s) => s.mode === 'car' && inArea(s.carX, s.carY, lotArea('buergeramt')),
    },
    parkIn('Park in a marked bay, set the Parkscheibe (P), then get out (F).', lotArea('buergeramt')),
    reach('Walk to the entrance of the Bürgeramt.', doorArea('buergeramt'), 'foot'),
  ],
  pay: 400,
  payLabel: 'Begrüßungsgeld for new residents',
  fee: { amount: 12, label: 'Anmeldegebühr (registration fee)' },
  completeNote: () => ['Your residence has been registered. Welcome to Bad Regelsheim, where order is a way of life.'],
};
