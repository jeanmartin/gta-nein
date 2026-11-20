import { describe, expect, it } from 'vitest';
import { buildMap } from '../src/world/MapData';
import { BIT, F, T, Z } from '../src/world/types';
import { POIS } from '../src/world/cityLayout';

const m = buildMap();

describe('city map', () => {
  it('builds intersections with the configured controls', () => {
    const byKey = new Map(m.intersections.map((i) => [i.key, i]));
    expect(byKey.get('H2|V2')?.control).toBe('light');
    expect(byKey.get('H4|V2')?.control).toBe('stop');
    expect(byKey.get('H4|V2')?.stopAxis).toBe('v');
    expect(byKey.get('H3|V2')?.control).toBe('rvl');
    expect(byKey.get('A1|A2')?.control).toBe('curve');
    // H2 × Marktstraße is only created once despite two street segments.
    expect(m.intersections.filter((i) => i.x0 === 58 && i.y0 === 44)).toHaveLength(1);
  });

  it('uses right-hand traffic', () => {
    expect(m.dir[m.idx(20, 44)]).toBe(BIT.W); // top lane of Bahnhofstraße
    expect(m.dir[m.idx(20, 45)]).toBe(BIT.E);
    expect(m.dir[m.idx(34, 60)]).toBe(BIT.S); // left lane of Goethestraße
    expect(m.dir[m.idx(35, 60)]).toBe(BIT.N);
    expect(m.dir[m.idx(58, 30)]).toBe(BIT.S); // one-way Marktstraße
    expect(m.dir[m.idx(59, 30)]).toBe(BIT.S);
  });

  it('marks zones, crosswalks and sidewalks', () => {
    expect(m.zone[m.idx(70, 32)]).toBe(Z.SPIEL);
    expect(m.zone[m.idx(50, 66)]).toBe(Z.Z30);
    expect(m.zone[m.idx(100, 6)]).toBe(Z.AUTOBAHN);
    expect(m.zone[m.idx(150, 82)]).toBe(Z.LAND);
    expect(m.flags[m.idx(33, 44)] & F.CROSSWALK).toBeTruthy(); // west of H2|V2
    expect(m.type[m.idx(30, 43)]).toBe(T.SIDEWALK);
    expect(m.flags[m.idx(50, 82)] & F.TUNNEL).toBeTruthy();
  });

  it('puts every POI door on a walkable tile and every lot next to a driveway', () => {
    for (const p of POIS) {
      expect(m.pedWalkable(p.door.x, p.door.y), `${p.id} door`).toBe(true);
      if (p.lot) expect(m.type[m.idx(p.lot.x, p.lot.y)] === T.LOT || m.type[m.idx(p.lot.x, p.lot.y)] === T.PARKING).toBe(true);
    }
    expect(m.type[m.idx(41, 61)]).toBe(T.PARKING);
    expect(m.type[m.idx(41, 58)]).toBe(T.DRIVEWAY);
  });

  it('has spawn tiles, signs, lights, Rentner and Blitzer', () => {
    expect(m.spawnLanes.length).toBeGreaterThan(500);
    expect(m.spawnWalk.length).toBeGreaterThan(500);
    expect(m.lightHeads.length).toBeGreaterThan(10);
    expect(m.signs.some((s) => s.kind === 'stop')).toBe(true);
    expect(m.signs.some((s) => s.kind === 'spiel')).toBe(true);
    expect(m.rentner.length).toBeGreaterThan(4);
    expect(m.blitzers.length).toBe(7);
  });
});
