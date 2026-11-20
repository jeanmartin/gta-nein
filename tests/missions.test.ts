import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/missions';
import { MissionManager } from '../src/missions/MissionManager';
import type { Letter, MissionCmd, MissionSnap } from '../src/missions/types';
import { Bureaucracy } from '../src/systems/Bureaucracy';
import { Clock } from '../src/systems/Clock';

function setup() {
  const clock = new Clock();
  const bureau = new Bureaucracy();
  const letters: Letter[] = [];
  const cmds: MissionCmd[] = [];
  let ended = false;
  const mm = new MissionManager(MISSIONS, clock, bureau, {
    letters: (l, done) => {
      letters.push(...l);
      done();
    },
    command: (c) => {
      cmds.push(c);
      if (c.type === 'clock') clock.set(c.day, c.h, c.m);
    },
    ending: () => {
      ended = true;
    },
    started: () => {},
  });
  return { clock, bureau, letters, cmds, mm, ended: () => ended };
}

function base(over: Partial<MissionSnap> = {}): MissionSnap {
  return {
    mode: 'car',
    px: 0,
    py: 0,
    carX: 0,
    carY: 0,
    carSpeedKmh: 0,
    carInBay: false,
    disc: false,
    belt: false,
    interact: false,
    dogX: null,
    dogY: null,
    gameDt: 0,
    ...over,
  };
}

describe('MissionManager', () => {
  it('runs order 1 from briefing to payment and starts order 2', () => {
    const { mm, letters, bureau, clock } = setup();
    mm.start(0);
    expect(mm.state).toBe('active');
    expect(clock.format()).toBe('Mo 07:50');
    mm.update(base({ belt: true }), 0.1);
    expect(mm.obj).toBe(1);
    mm.update(base({ belt: true, carX: 54.5, carY: 41.5 }), 0.1);
    expect(mm.obj).toBe(2);
    mm.update(base({ mode: 'foot', carX: 54.5, carY: 40.5, carInBay: true, disc: true }), 0.1);
    expect(mm.obj).toBe(3);
    const before = bureau.money;
    mm.update(base({ mode: 'foot', px: 46.5, py: 43.5 }), 0.1);
    expect(bureau.money).toBeGreaterThan(before);
    expect(letters.some((l) => l.stamp === 'ERLEDIGT')).toBe(true);
    expect(mm.index).toBe(1);
  });

  it('fails the TÜV appointment when too late and restarts it', () => {
    const { mm, clock, bureau } = setup();
    mm.start(4);
    clock.set(2, 14, 6);
    const fines = bureau.fineCount;
    mm.update(base(), 0.1);
    expect(mm.index).toBe(4);
    expect(clock.format()).toBe('Mi 13:20');
    expect(fines).toBe(bureau.fineCount); // fine is issued via command, not directly
  });

  it('triggers the ending after the tax return', () => {
    const t = setup();
    t.mm.start(7);
    t.mm.update(base({ mode: 'foot', px: 97.5, py: 46.5 }), 0.1);
    t.mm.update(base({ mode: 'foot', px: 70.5, py: 68.5 }), 0.1);
    t.mm.update(base({ mode: 'foot', px: 25.5, py: 43.5, interact: true }), 0.1);
    expect(t.ended()).toBe(true);
  });

  it('fails the tax return after midnight', () => {
    const t = setup();
    t.mm.start(7);
    t.clock.set(5, 0, 5);
    t.mm.update(base(), 0.1);
    expect(t.cmds.some((c) => c.type === 'fine' && c.id === 'late')).toBe(true);
  });
});
