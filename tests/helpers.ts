import { TILE } from '../src/config';
import type { PlayerInfo, Snapshot } from '../src/rules/RuleEngine';
import { Clock } from '../src/systems/Clock';

export const px = (tile: number): number => tile * TILE + TILE / 2;

export function player(over: Partial<PlayerInfo> = {}): PlayerInfo {
  return {
    mode: 'car',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
    speedKmh: 0,
    belt: true,
    lights: true,
    blinker: 0,
    ...over,
  };
}

export function snap(p: PlayerInfo, over: Partial<Snapshot> = {}): Snapshot {
  const clock = new Clock();
  clock.set(0, 10, 0);
  return { t: 0, clock, player: p, npcs: [], peds: [], ambulance: null, ...over };
}
