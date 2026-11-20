/** Every offence the Ordnungsamt can think of. Citations are fictional ("StVO-NEIN"). */

export interface Offence {
  title: string;
  law: string;
  amount: number;
  points: number;
  flavour: string[];
}

export const OFFENCES = {
  // ── Speed ──────────────────────────────────────────────
  speed_1_10: {
    title: 'Speeding by 1–10 km/h (Geschwindigkeitsüberschreitung)',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 30,
    points: 0,
    flavour: ['Every km/h counts. We counted them.', 'Your Bürgerfahrtenschreiber has reported you.'],
  },
  speed_11_15: {
    title: 'Speeding by 11–15 km/h',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 50,
    points: 0,
    flavour: ['Raser! Rowdy! Hooligan!'],
  },
  speed_16_20: {
    title: 'Speeding by 16–20 km/h',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 70,
    points: 0,
    flavour: ['Please consider your life choices.'],
  },
  speed_21_25: {
    title: 'Speeding by 21–25 km/h',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 115,
    points: 1,
    flavour: ['A point has been sent to Flensburg. It is happy there.'],
  },
  speed_26_30: {
    title: 'Speeding by 26–30 km/h',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 180,
    points: 1,
    flavour: ['This is not the Autobahn. (Not even there, morally.)'],
  },
  speed_31_plus: {
    title: 'Speeding by more than 30 km/h',
    law: '§ 3 Abs. 3 StVO-NEIN',
    amount: 260,
    points: 2,
    flavour: ['NEIN. NEIN. NEIN.'],
  },
  tolerance_fee: {
    title: 'Toleranzabzug-Berechnungsgebühr',
    law: '§ 3a GebO-NEIN',
    amount: 12.5,
    points: 0,
    flavour: [
      'After the 3 km/h tolerance you were legal. Calculating that was not free.',
      'Congratulations, you were within tolerance. That is €12.50.',
    ],
  },
  min_speed: {
    title: 'Driving below the minimum speed on the Autobahn',
    law: '§ 18 Abs. 1 StVO-NEIN',
    amount: 20,
    points: 0,
    flavour: ['Gemütlichkeit is reserved for the Biergarten.'],
  },
  // ── Junctions ──────────────────────────────────────────
  red_light: {
    title: 'Running a red light (Rotlichtverstoß)',
    law: '§ 37 Abs. 2 StVO-NEIN',
    amount: 90,
    points: 1,
    flavour: ['Red means NEIN.', 'The traffic light is deeply disappointed in you.'],
  },
  amber_light: {
    title: 'Crossing on amber (Gelb ist kein Grün)',
    law: '§ 37 Abs. 2 Nr. 1 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['Amber means: prepare to feel guilty.'],
  },
  stop_sign: {
    title: 'Rolling stop at a STOP sign (Räder müssen stillstehen)',
    law: '§ 41 Z. 206 StVO-NEIN',
    amount: 35,
    points: 0,
    flavour: ['STOP means 0.0 km/h. Not 0.4. We measured.'],
  },
  right_before_left: {
    title: 'Ignored Rechts vor Links',
    law: '§ 8 Abs. 1 StVO-NEIN',
    amount: 25,
    points: 0,
    flavour: ['Right before left. It is not that hard. It is in the name.'],
  },
  no_blinker: {
    title: 'Turning without indicator (Blinker)',
    law: '§ 9 Abs. 1 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['How should anyone know your intentions? Are we mind readers? (We are working on it.)'],
  },
  misleading_blinker: {
    title: 'Misleading indicator (Irreführendes Blinken)',
    law: '§ 9 Abs. 1 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['You indicated, then went straight on. Chaos!'],
  },
  blinker_forever: {
    title: 'Dauerblinken',
    law: '§ 9 Abs. 1a StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['You are not on holiday. Turn it off.'],
  },
  lane_change_no_blinker: {
    title: 'Lane change without indicator',
    law: '§ 7 Abs. 5 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['Spurwechsel without Blinker. Anarchy.'],
  },
  zebra: {
    title: 'Did not stop for a pedestrian at the Zebrastreifen',
    law: '§ 26 StVO-NEIN',
    amount: 80,
    points: 1,
    flavour: ['The pedestrian has already filed a complaint. In triplicate.'],
  },
  // ── Lanes & surfaces ───────────────────────────────────
  keep_right: {
    title: 'Violation of the Rechtsfahrgebot (driving on the left)',
    law: '§ 2 Abs. 2 StVO-NEIN',
    amount: 80,
    points: 1,
    flavour: ['This is not Britain.'],
  },
  wrong_way_oneway: {
    title: 'Wrong way in an Einbahnstraße',
    law: '§ 41 Z. 220 StVO-NEIN',
    amount: 25,
    points: 0,
    flavour: ['Einbahn means ONE. Ein. Eins.'],
  },
  ghost_driver: {
    title: 'Geisterfahrer on the Autobahn',
    law: '§ 18 Abs. 7 StVO-NEIN',
    amount: 200,
    points: 2,
    flavour: ['Achtung, Geisterfahrer! (It is you.)'],
  },
  sidewalk_drive: {
    title: 'Driving on the sidewalk (Gehweg)',
    law: '§ 2 Abs. 1 StVO-NEIN',
    amount: 55,
    points: 0,
    flavour: ['A Rentner has dropped his Brötchen in shock.'],
  },
  bikelane_drive: {
    title: 'Driving on the bike lane (Radweg)',
    law: '§ 2 Abs. 4 StVO-NEIN',
    amount: 55,
    points: 0,
    flavour: ['A cyclist is now writing a strongly worded blog post.'],
  },
  lawn_drive: {
    title: 'Driving on a public lawn (Grünanlage)',
    law: '§ 4 GrünAnlS-NEIN',
    amount: 50,
    points: 0,
    flavour: ['The Gärtnerei-Amt sends its regards.'],
  },
  field_drive: {
    title: 'Driving across a field (Acker)',
    law: '§ 23 FeldSchG-NEIN',
    amount: 35,
    points: 0,
    flavour: ['The farmer has already reported you. He was waiting for this.'],
  },
  // ── Vehicle ────────────────────────────────────────────
  no_belt: {
    title: 'Not wearing a seatbelt (Gurtpflicht)',
    law: '§ 21a StVO-NEIN',
    amount: 30,
    points: 0,
    flavour: ['Anschnallen! Press B. Every time. Yes, every time.'],
  },
  horn: {
    title: 'Unnecessary honking (Unnötiges Hupen)',
    law: '§ 16 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['There was no danger. We checked.', 'The horn is for emergencies. Feelings are not emergencies.'],
  },
  horn_quiet: {
    title: 'Honking during the Ruhezeit (Ruhestörung)',
    law: '§ 117 OWiG-NEIN',
    amount: 20,
    points: 0,
    flavour: ['The whole street was having its Mittagsschlaf.', 'Ruhe! RUHE!'],
  },
  no_lights_tunnel: {
    title: 'Tunnel without headlights',
    law: '§ 17 Abs. 4a StVO-NEIN',
    amount: 20,
    points: 0,
    flavour: ['Press L. Let there be (regulated) light.'],
  },
  no_lights_night: {
    title: 'Driving without lights at night',
    law: '§ 17 Abs. 1 StVO-NEIN',
    amount: 20,
    points: 0,
    flavour: ['It is dark. Press L.'],
  },
  overtake_right: {
    title: 'Overtaking on the right (Rechtsüberholen)',
    law: '§ 5 Abs. 1 StVO-NEIN',
    amount: 100,
    points: 1,
    flavour: ['Overtaking is done on the LEFT. Like everything orderly.'],
  },
  no_rescue_lane: {
    title: 'Failure to form a Rettungsgasse',
    law: '§ 11 Abs. 2 StVO-NEIN',
    amount: 200,
    points: 2,
    flavour: ['Make room! Move to the edge of your lane when the ambulance comes.'],
  },
  // ── Collisions & parking ───────────────────────────────
  property_damage: {
    title: 'Sachbeschädigung (you touched public property)',
    law: '§ 303 StGB-NEIN',
    amount: 35,
    points: 0,
    flavour: ['That wall was listed (denkmalgeschützt).', 'A Gutachter is on his way. He bills by the hour.'],
  },
  collision_car: {
    title: 'Causing a traffic accident (Unfall)',
    law: '§ 1 Abs. 2 StVO-NEIN',
    amount: 100,
    points: 1,
    flavour: ['The other driver is fine but deeply offended.'],
  },
  ped_hit: {
    title: 'Endangering a pedestrian',
    law: '§ 1 Abs. 2 StVO-NEIN',
    amount: 150,
    points: 2,
    flavour: ['The pedestrian is unharmed but will tell everyone at the Stammtisch.'],
  },
  wrong_parking: {
    title: 'Parking outside a marked bay (Falschparken)',
    law: '§ 12 StVO-NEIN',
    amount: 25,
    points: 0,
    flavour: ['Parking is only permitted where parking is permitted.'],
  },
  no_disc: {
    title: 'Parkscheibe not displayed',
    law: '§ 13 Abs. 2 StVO-NEIN',
    amount: 20,
    points: 0,
    flavour: ['Press P BEFORE leaving the car. The Ordnungsamt was already waiting.'],
  },
  car_theft: {
    title: 'Attempted vehicle theft (not your car)',
    law: '§ 248b StGB-NEIN',
    amount: 50,
    points: 0,
    flavour: ['NEIN! That is not your car. This is not that kind of game.'],
  },
  // ── On foot ────────────────────────────────────────────
  jaywalk: {
    title: 'Crossing the road outside a crosswalk',
    law: '§ 25 Abs. 3 StVO-NEIN',
    amount: 5,
    points: 0,
    flavour: ['Use the Zebrastreifen or the Ampel. They exist for a reason.'],
  },
  red_ped: {
    title: 'Crossing at a red Ampelmännchen',
    law: '§ 37 Abs. 2 Nr. 5 StVO-NEIN',
    amount: 5,
    points: 0,
    flavour: [
      'Was sollen denn die Kinder denken?!',
      'There was no car for miles. That is not the point.',
    ],
  },
  walk_bikelane: {
    title: 'Walking on the bike lane',
    law: '§ 25 Abs. 1 StVO-NEIN',
    amount: 10,
    points: 0,
    flavour: ['A cyclist rang his bell at you. Twice. Aggressively.'],
  },
  lawn: {
    title: 'Rasen betreten verboten',
    law: '§ 3 GrünAnlS-NEIN',
    amount: 10,
    points: 0,
    flavour: ['Keep off the grass. The grass has rights too.'],
  },
  loitering: {
    title: 'Loitering in front of the Finanzamt',
    law: '§ 1 HerumlungerVO-NEIN',
    amount: 15,
    points: 0,
    flavour: ['Standing around suspiciously near tax officials.'],
  },
  obstruct_traffic: {
    title: 'Obstructing traffic (you were hit by a car)',
    law: '§ 1 Abs. 2 StVO-NEIN',
    amount: 20,
    points: 0,
    flavour: ['The driver who hit you has filed a complaint. Against you.'],
  },
  // ── Mission specific ───────────────────────────────────
  glass_quiet: {
    title: 'Disposing of glass during the Ruhezeit',
    law: '§ 7 Abs. 2 AbfallS-NEIN',
    amount: 35,
    points: 0,
    flavour: ['Glass only Mo–Sa 08–13 and 15–19 Uhr. Press Z to wait.'],
  },
  wrong_bin: {
    title: 'Fehlwurf (wrong recycling container)',
    law: '§ 12 KrWG-NEIN',
    amount: 50,
    points: 0,
    flavour: ['A waste inspector has returned your bag, with a fine.'],
  },
  dog_poop: {
    title: 'Hundekot nicht beseitigt',
    law: '§ 9 StraßenReinS-NEIN',
    amount: 75,
    points: 0,
    flavour: ['Waldi did his business. You did not do yours.'],
  },
  early: {
    title: 'Vorzeitiges Erscheinen (arriving early)',
    law: '§ 1 TerminVO-NEIN',
    amount: 15,
    points: 0,
    flavour: ['Your appointment is at 14:00. Not 13:52. Please wait outside.'],
  },
  late: {
    title: 'Termin versäumt / Frist versäumt',
    law: '§ 2 TerminVO-NEIN',
    amount: 50,
    points: 0,
    flavour: ['New appointment available in 6–8 months.'],
  },
  // ── Witnesses & extras ─────────────────────────────────
  anzeige: {
    title: 'Anzeige by an attentive citizen',
    law: '§ 158 StPO-NEIN',
    amount: 15,
    points: 0,
    flavour: ['A neighbour saw everything from behind the Gardine.'],
  },
  photo_fee: {
    title: 'Lichtbildgebühr (Blitzer photo)',
    law: '§ 107 OWiG-NEIN',
    amount: 8.5,
    points: 0,
    flavour: ['Nice photo. Copies available for €8.50 each.'],
  },
} satisfies Record<string, Offence>;

export type OffenceId = keyof typeof OFFENCES;

/** Gebühren (€25) + Auslagen (€3.50) on every Bußgeldbescheid. */
export const BESCHEID_FEE = 28.5;
/** From this amount on it's a Bußgeldbescheid (with fee), below it a Verwarnung. */
export const BUSSGELD_THRESHOLD = 60;

export function speedOffence(measured: number, limit: number): { id: OffenceId; detail: string } {
  const after = measured - 3;
  const over = after - limit;
  const detail = `Measured ${measured} km/h − 3 km/h Toleranz = ${after} km/h (limit ${limit})`;
  if (over <= 0) return { id: 'tolerance_fee', detail };
  if (over <= 10) return { id: 'speed_1_10', detail };
  if (over <= 15) return { id: 'speed_11_15', detail };
  if (over <= 20) return { id: 'speed_16_20', detail };
  if (over <= 25) return { id: 'speed_21_25', detail };
  if (over <= 30) return { id: 'speed_26_30', detail };
  return { id: 'speed_31_plus', detail };
}
