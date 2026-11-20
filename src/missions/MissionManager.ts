/** Runs the campaign: briefing letter → objectives → payment letter → next order. Pure module. */
import type { Bureaucracy } from '../systems/Bureaucracy';
import type { Clock } from '../systems/Clock';
import type { Letter, Mission, MissionCmd, MissionCtx, MissionSnap, Objective } from './types';

export interface MissionHooks {
  /** Show letters one after another; call `done` when the player has acknowledged all. */
  letters(letters: Letter[], done: () => void): void;
  command(cmd: MissionCmd): void;
  /** Called after the final mission has been completed. */
  ending(): void;
  /** Called whenever a mission is (re)started, e.g. to save the game. */
  started(index: number): void;
}

export type MissionState = 'idle' | 'briefing' | 'active' | 'complete';

export class MissionManager {
  index = 0;
  obj = 0;
  state: MissionState = 'idle';
  readonly ctx: MissionCtx;
  private startAbs = 0;

  constructor(
    readonly missions: Mission[],
    clock: Clock,
    bureau: Bureaucracy,
    private readonly hooks: MissionHooks,
  ) {
    this.ctx = { clock, bureau, flags: {}, emit: (c) => hooks.command(c) };
  }

  get mission(): Mission | undefined {
    return this.missions[this.index];
  }

  get objective(): Objective | undefined {
    return this.state === 'active' ? this.mission?.objectives[this.obj] : undefined;
  }

  objectiveText(): string {
    const o = this.objective;
    if (!o) return '';
    return typeof o.text === 'function' ? o.text(this.ctx) : o.text;
  }

  start(index: number): void {
    this.index = index;
    this.obj = 0;
    const m = this.mission;
    if (!m) return;
    this.ctx.flags = {};
    this.state = 'briefing';
    m.setup(this.ctx);
    this.startAbs = this.ctx.clock.day * 1440 + this.ctx.clock.minutes;
    this.hooks.started(index);
    this.hooks.letters([{ ...m.letter, az: `Anordnung ${m.id}/8` }], () => {
      this.state = 'active';
      m.objectives[0]?.start?.(this.ctx);
    });
  }

  update(s: MissionSnap, dt: number): void {
    const m = this.mission;
    if (this.state !== 'active' || !m) return;
    m.tick?.(s, this.ctx, dt, this.obj);
    if (this.state !== 'active') return;
    const o = m.objectives[this.obj];
    if (!o) return;
    if (o.deadline !== undefined && this.elapsed() > o.deadline - (this.startAbs % 1440)) {
      this.fail();
      return;
    }
    const r = o.update(s, this.ctx, dt);
    if (r === 'fail') this.fail();
    else if (r) this.advance();
  }

  /** Game minutes since the mission started (handles midnight and week wrap). */
  elapsed(): number {
    const week = 7 * 1440;
    const now = this.ctx.clock.day * 1440 + this.ctx.clock.minutes;
    return (now - this.startAbs + week) % week;
  }

  /** Debug helper and internal step. */
  advance(): void {
    const m = this.mission;
    if (!m || this.state !== 'active') return;
    this.obj++;
    if (this.obj >= m.objectives.length) this.complete();
    else {
      this.hooks.command({ type: 'sfx', name: 'ok' });
      m.objectives[this.obj].start?.(this.ctx);
    }
  }

  private complete(): void {
    const m = this.mission;
    if (!m) return;
    this.state = 'complete';
    this.hooks.command({ type: 'sfx', name: 'fanfare' });
    if (m.final) {
      this.hooks.ending();
      return;
    }
    const b = this.ctx.bureau;
    const notes = m.completeNote?.(this.ctx) ?? [];
    const table: { label: string; amount: number }[] = [];
    if (m.pay > 0) {
      const inc = b.income(m.pay, m.payLabel);
      table.push(...inc.lines);
    }
    if (m.fee) {
      b.charge(m.fee.amount, false);
      table.push({ label: m.fee.label, amount: -m.fee.amount });
    }
    const rundfunk = 18.36;
    b.charge(rundfunk);
    table.push({ label: 'Rundfunkbeitrag (you own a car radio)', amount: -rundfunk });
    const letter: Letter = {
      from: 'Stadtkasse Bad Regelsheim',
      subject: `Notice of payment — Order ${m.id}: "${m.title}" completed`,
      body: [...notes, 'The following amounts have been booked to your account:'],
      table,
      stamp: 'ERLEDIGT',
    };
    this.hooks.letters([letter], () => {
      if (this.index + 1 < this.missions.length) this.start(this.index + 1);
    });
  }

  fail(): void {
    const m = this.mission;
    if (!m || this.state !== 'active') return;
    this.state = 'complete';
    this.hooks.command({ type: 'fine', id: 'late' });
    this.hooks.letters(
      [
        {
          from: 'Ordnungsamt Bad Regelsheim',
          subject: `Order ${m.id} "${m.title}": deadline missed`,
          body: [m.failText ?? 'You have failed to comply. The order will be reissued.'],
          stamp: 'FRIST VERSÄUMT',
        },
      ],
      () => this.start(this.index),
    );
  }
}
