import { describe, expect, it } from 'vitest';
import { START_MONEY } from '../src/config';
import { speedOffence } from '../src/rules/catalog';
import { Bureaucracy } from '../src/systems/Bureaucracy';

describe('Bureaucracy', () => {
  it('issues Verwarnungen without fee and Bußgeldbescheide with fee', () => {
    const b = new Bureaucracy(() => 0);
    const v = b.fine('horn');
    expect(v.kind).toBe('Verwarnung');
    expect(v.total).toBe(10);
    const bg = b.fine('red_light');
    expect(bg.kind).toBe('Bußgeldbescheid');
    expect(bg.total).toBe(90 + 28.5);
    expect(b.points).toBe(1);
    expect(b.money).toBeCloseTo(START_MONEY - 10 - 118.5);
    expect(v.az).not.toBe(bg.az);
  });

  it('taxes income the German way', () => {
    const b = new Bureaucracy();
    const { net, lines } = b.income(1000, 'Test');
    expect(lines).toHaveLength(4);
    expect(net).toBeCloseTo(1000 - 420 - 23.1 - 37.8);
  });

  it('detects game over conditions', () => {
    const b = new Bureaucracy();
    for (let i = 0; i < 4; i++) b.fine('ghost_driver');
    expect(b.licenceRevoked).toBe(true);
    const c = new Bureaucracy();
    c.charge(START_MONEY + 1);
    expect(c.broke).toBe(true);
  });

  it('round-trips state and computes the brake fluid tax', () => {
    const b = new Bureaucracy();
    b.brakeFluidL = 2;
    b.fine('jaywalk');
    const c = new Bureaucracy();
    c.restore(b.state());
    expect(c.money).toBe(b.money);
    const tax = c.brakeFluidTax();
    expect(tax.total).toBeGreaterThan(4711);
    expect(tax.years).toBeGreaterThanOrEqual(2);
  });
});

describe('speedOffence', () => {
  it('applies the 3 km/h tolerance and charges for calculating it', () => {
    expect(speedOffence(52, 50).id).toBe('tolerance_fee');
    expect(speedOffence(54, 50).id).toBe('speed_1_10');
    expect(speedOffence(70, 50).id).toBe('speed_16_20');
    expect(speedOffence(90, 50).id).toBe('speed_31_plus');
  });
});
