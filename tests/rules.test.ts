import { describe, expect, it } from 'vitest';
import { RuleEngine, type PlayerInfo, type Snapshot, type Violation } from '../src/rules/RuleEngine';
import { buildMap } from '../src/world/MapData';
import { LIGHT_CYCLE, lightAt } from '../src/world/TrafficLights';
import { player, px, snap } from './helpers';

const map = buildMap();

/** Run the engine along a list of tile positions (one step per tile). */
function drive(e: RuleEngine, steps: [number, number][], p: Partial<PlayerInfo>, over: Partial<Snapshot> = {}): Violation[] {
  const out: Violation[] = [];
  for (const [tx, ty] of steps) {
    const s = snap(player({ ...p, x: px(tx), y: px(ty) }), over);
    for (let k = 0; k < 4; k++) out.push(...e.update(s, 0.1));
  }
  return out;
}
const ids = (v: Violation[]) => v.map((x) => x.id);

function timeWith(offset: number, pred: (s: ReturnType<typeof lightAt>) => boolean): number {
  for (let t = 0; t < LIGHT_CYCLE; t += 0.25) if (pred(lightAt(t, offset))) return t;
  throw new Error('no such phase');
}

describe('RuleEngine — driving', () => {
  it('fines speeding (after tolerance) in a 50 zone', () => {
    const v = drive(new RuleEngine(map), [[20, 45], [21, 45]], { speedKmh: 60, vx: 240 });
    expect(ids(v)).toContain('speed_1_10');
  });

  it('charges the tolerance fee just above the limit', () => {
    const v = drive(new RuleEngine(map), [[20, 45], [21, 45]], { speedKmh: 52, vx: 208 });
    expect(ids(v)).toContain('tolerance_fee');
  });

  it('is happy at exactly the limit', () => {
    const v = drive(new RuleEngine(map), [[20, 45], [21, 45], [22, 45]], { speedKmh: 50, vx: 200 });
    expect(v).toEqual([]);
  });

  it('fines driving on the left', () => {
    const v = drive(new RuleEngine(map), [[20, 44], [21, 44]], { speedKmh: 30, vx: 120 });
    expect(ids(v)).toContain('keep_right');
  });

  it('warns about the seatbelt first, then fines only once until buckled', () => {
    const e = new RuleEngine(map);
    const lane: [number, number][] = [];
    for (let x = 14; x < 30; x++) lane.push([x, 45]);
    const p = { speedKmh: 30, vx: 120, belt: false };
    const first = drive(e, lane.slice(0, 1), p); // 0.4 s: nothing yet
    expect(ids(first)).not.toContain('no_belt');
    drive(e, lane.slice(1, 2), p);
    const rest = drive(e, lane.slice(2), p); // ~5.6 s more unbuckled
    expect(ids(rest).filter((i) => i === 'no_belt')).toHaveLength(1);
    // Buckling up re-arms the rule.
    drive(e, lane.slice(0, 1), { ...p, belt: true });
    expect(ids(drive(e, lane.slice(0, 10), p)).filter((i) => i === 'no_belt')).toHaveLength(1);
  });

  it('fines running a red light, but not a green one', () => {
    const is = map.intersections.find((i) => i.key === 'H2|V2')!;
    const red = timeWith(is.offset, (s) => s.h === 'red' && s.v === 'green');
    const green = timeWith(is.offset, (s) => s.h === 'green');
    const steps: [number, number][] = [[31, 45], [32, 45], [33, 45], [34, 45]];
    expect(ids(drive(new RuleEngine(map), steps, { speedKmh: 30, vx: 120 }, { t: red }))).toContain('red_light');
    expect(ids(drive(new RuleEngine(map), steps, { speedKmh: 30, vx: 120 }, { t: green }))).not.toContain('red_light');
  });

  it('requires a full stop at STOP signs', () => {
    // Goethestraße southbound into Ringstraße (stop on the vertical axis).
    const steps: [number, number][] = [[34, 79], [34, 80], [34, 81], [34, 82]];
    expect(ids(drive(new RuleEngine(map), steps, { speedKmh: 20, vy: 80 }))).toContain('stop_sign');
    const e = new RuleEngine(map);
    drive(e, [[34, 80]], { speedKmh: 20, vy: 80 });
    drive(e, [[34, 81]], { speedKmh: 0, vy: 0 });
    expect(ids(drive(e, [[34, 82]], { speedKmh: 10, vy: 40 }))).not.toContain('stop_sign');
  });

  it('requires the indicator when turning and cancels it afterwards', () => {
    // Schulstraße eastbound, right turn into Goethestraße southbound (rechts vor links junction).
    const steps: [number, number][] = [[32, 67], [33, 67], [34, 67], [34, 68]];
    const without = drive(new RuleEngine(map), steps, { speedKmh: 15, vx: 60, vy: 0 });
    expect(ids(without)).toContain('no_blinker');
    const e = new RuleEngine(map);
    const withB = drive(e, steps, { speedKmh: 15, vx: 60, blinker: 1 });
    expect(ids(withB)).not.toContain('no_blinker');
  });

  it('enforces rechts vor links', () => {
    const is = map.intersections.find((i) => i.key === 'H3|V2')!;
    // A car coming from the south (our right when heading east), driving north.
    const npc = { id: 1, x: px(35), y: is.cy + 3 * 32, vx: 0, vy: -100, heading: -Math.PI / 2 };
    const v = drive(new RuleEngine(map), [[32, 67], [33, 67], [34, 67]], { speedKmh: 15, vx: 60 }, { npcs: [npc] });
    expect(ids(v)).toContain('right_before_left');
  });

  it('fines driving on the sidewalk and the bike lane', () => {
    expect(ids(drive(new RuleEngine(map), [[30, 43], [29, 43]], { speedKmh: 10, vx: -40 }))).toContain('sidewalk_drive');
    expect(ids(drive(new RuleEngine(map), [[70, 43], [71, 43]], { speedKmh: 10, vx: 40 }))).toContain('bikelane_drive');
  });

  it('wants headlights in the tunnel', () => {
    const v = drive(new RuleEngine(map), [[50, 83], [51, 83]], { speedKmh: 40, vx: 160, lights: false });
    expect(ids(v)).toContain('no_lights_tunnel');
  });
});

describe('RuleEngine — events', () => {
  it('handles parking and the Parkscheibe', () => {
    const e = new RuleEngine(map);
    const s = snap(player());
    expect(ids(e.onEvent({ type: 'exitCar', x: px(20), y: px(45), disc: true }, s))).toEqual(['wrong_parking']);
    expect(ids(e.onEvent({ type: 'exitCar', x: px(41), y: px(61), disc: false }, s))).toEqual(['no_disc']);
    expect(e.onEvent({ type: 'exitCar', x: px(41), y: px(61), disc: true }, s)).toEqual([]);
  });

  it('doubles down on honking during Sonntagsruhe', () => {
    const e = new RuleEngine(map);
    const s = snap(player());
    expect(ids(e.onEvent({ type: 'horn' }, s))).toEqual(['horn']);
    s.clock.set(6, 11, 0);
    s.t = 5;
    expect(ids(e.onEvent({ type: 'horn' }, s))).toEqual(['horn_quiet']);
  });
});

describe('RuleEngine — on foot', () => {
  it('fines jaywalking and walking on the lawn', () => {
    expect(ids(drive(new RuleEngine(map), [[20, 43], [20, 44], [20, 44]], { mode: 'foot', belt: false }))).toContain('jaywalk');
    expect(ids(drive(new RuleEngine(map), [[12, 50], [14, 50], [15, 50]], { mode: 'foot' }))).toContain('lawn');
  });

  it('fines crossing at a red Ampelmännchen', () => {
    const is = map.intersections.find((i) => i.key === 'H2|V2')!;
    const tRed = timeWith(is.offset, (s) => s.v !== 'green');
    const tGreen = timeWith(is.offset, (s) => s.v === 'green');
    const steps: [number, number][] = [[33, 43], [33, 44], [33, 45]];
    expect(ids(drive(new RuleEngine(map), steps, { mode: 'foot' }, { t: tRed }))).toContain('red_ped');
    expect(ids(drive(new RuleEngine(map), steps, { mode: 'foot' }, { t: tGreen }))).toEqual([]);
  });
});
