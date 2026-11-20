/** Deterministic traffic-light phases. Pure module. */
import type { Axis } from './types';

export type Lamp = 'red' | 'redamber' | 'green' | 'amber';
export interface LightState {
  h: Lamp;
  v: Lamp;
}

/** [horizontal lamp, vertical lamp, duration in seconds] */
const PHASES: readonly [Lamp, Lamp, number][] = [
  ['green', 'red', 10],
  ['amber', 'red', 2.5],
  ['red', 'red', 1.5],
  ['red', 'redamber', 1],
  ['red', 'green', 10],
  ['red', 'amber', 2.5],
  ['red', 'red', 1.5],
  ['redamber', 'red', 1],
];
export const LIGHT_CYCLE = PHASES.reduce((s, p) => s + p[2], 0);

export function lightAt(t: number, offset: number): LightState {
  let x = (((t + offset) % LIGHT_CYCLE) + LIGHT_CYCLE) % LIGHT_CYCLE;
  for (const [h, v, d] of PHASES) {
    if (x < d) return { h, v };
    x -= d;
  }
  return { h: 'red', v: 'red' };
}

export function lampFor(state: LightState, axis: Axis): Lamp {
  return axis === 'h' ? state.h : state.v;
}

/** Pedestrians crossing a road of `roadAxis` may walk when the other axis has green. */
export function pedGreen(state: LightState, roadAxis: Axis): boolean {
  return (roadAxis === 'h' ? state.v : state.h) === 'green';
}
