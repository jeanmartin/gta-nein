import { bayOf, doorArea, doorPos, lotArea, parkIn, reach } from './helpers';
import type { Mission } from './types';

export const m4: Mission = {
  id: 4,
  title: 'Sonntagsruhe',
  letter: {
    from: 'Oma (Einschreiben mit Rückschein)',
    subject: 'Kaffee und Kuchen!!',
    body: [
      'Mein Schatz,',
      'come to me on the Lindenweg for Kaffee und Kuchen today. Bring the Schwarzwälder Kirschtorte I left in your kitchen (it is already in your car).',
      'Remember, it is SUNDAY: no honking, no car washing, no lawn mowing, no loud thoughts. My street is a Spielstraße: you may only drive at walking speed (7 km/h). Frau Kowalski next door has bought a radar gun.',
      'And the Marktstraße is one-way going SOUTH between the Hauptstraße and the Bahnhofstraße. Do not embarrass me.',
      'Kuss, Oma',
    ],
  },
  setup(ctx) {
    ctx.emit({ type: 'clock', day: 6, h: 10, m: 0 });
    ctx.emit({ type: 'place', mode: 'foot', player: doorPos('home'), car: bayOf('home', 1), disc: true });
  },
  objectives: [
    { text: "Get in your car (F). Oma's cake is on the passenger seat.", update: (s) => s.mode === 'car' },
    parkIn(
      "Drive to Oma on the Lindenweg (Spielstraße: 7 km/h!). Park in her yard.",
      lotArea('oma'),
    ),
    reach("Bring the cake to Oma's door.", doorArea('oma'), 'foot'),
  ],
  pay: 300,
  payLabel: "Oma's Geldgeschenk (taxable gift)",
  completeNote: () => ['Oma says the cake was "fine". Your cousin brought a better one.'],
};
