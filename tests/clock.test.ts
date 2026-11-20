import { describe, expect, it } from 'vitest';
import { Clock } from '../src/systems/Clock';
import { LIGHT_CYCLE, lightAt, pedGreen } from '../src/world/TrafficLights';

describe('Clock', () => {
  it('knows the German quiet times', () => {
    const c = new Clock();
    c.set(1, 13, 30);
    expect(c.isMittagsruhe).toBe(true);
    expect(c.isQuietTime).toBe(true);
    expect(c.glassAllowed).toBe(false);
    c.set(1, 15, 0);
    expect(c.glassAllowed).toBe(true);
    c.set(6, 10, 0);
    expect(c.isSunday && c.isQuietTime).toBe(true);
    expect(c.glassAllowed).toBe(false);
    c.set(4, 22, 30);
    expect(c.isNachtruhe && c.isNight).toBe(true);
  });

  it('advances across midnight and speeds up while waiting', () => {
    const c = new Clock();
    c.set(6, 23, 59);
    c.advance(2);
    expect(c.day).toBe(0);
    expect(c.format()).toBe('Mo 00:01');
    c.waiting = true;
    c.advance(1);
    expect(Math.round(c.minutes)).toBe(1 + c.waitRate);
  });
});

describe('Traffic lights', () => {
  it('never shows green on both axes', () => {
    for (let t = 0; t < LIGHT_CYCLE; t += 0.1) {
      const s = lightAt(t, 3);
      expect(s.h === 'green' && s.v === 'green').toBe(false);
    }
  });
  it('gives pedestrians green when cross traffic has green', () => {
    expect(pedGreen({ h: 'red', v: 'green' }, 'h')).toBe(true);
    expect(pedGreen({ h: 'green', v: 'red' }, 'h')).toBe(false);
  });
});
