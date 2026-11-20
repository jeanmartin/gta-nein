/** Wallet, Flensburg points, fine ledger and taxes. Pure module. */
import { MAX_POINTS, START_MONEY } from '../config';
import { BESCHEID_FEE, BUSSGELD_THRESHOLD, OFFENCES, type OffenceId } from '../rules/catalog';

export interface FineRecord {
  az: string;
  id: OffenceId;
  title: string;
  law: string;
  amount: number;
  fee: number;
  total: number;
  points: number;
  detail?: string;
  flavour: string;
  kind: 'Verwarnung' | 'Bußgeldbescheid';
}

export interface IncomeLine {
  label: string;
  amount: number;
}

export interface BureauState {
  money: number;
  points: number;
  fineCount: number;
  finesTotal: number;
  taxesPaid: number;
  brakeFluidL: number;
  counter: number;
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const formatEur = (v: number): string => eur.format(v);

export class Bureaucracy {
  money = START_MONEY;
  points = 0;
  fineCount = 0;
  finesTotal = 0;
  taxesPaid = 0;
  brakeFluidL = 0;
  counter = 0;
  readonly recent: FineRecord[] = [];
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  nextAz(prefix = 'OA'): string {
    this.counter++;
    return `${prefix}-2026-${String(4711 + this.counter * 17).padStart(6, '0')}`;
  }

  fine(id: OffenceId, detail?: string): FineRecord {
    const o = OFFENCES[id];
    const fee = o.amount >= BUSSGELD_THRESHOLD ? BESCHEID_FEE : 0;
    const total = o.amount + fee;
    const rec: FineRecord = {
      az: this.nextAz(),
      id,
      title: o.title,
      law: o.law,
      amount: o.amount,
      fee,
      total,
      points: o.points,
      detail,
      flavour: o.flavour[Math.floor(this.rng() * o.flavour.length)] ?? '',
      kind: fee > 0 ? 'Bußgeldbescheid' : 'Verwarnung',
    };
    this.money -= total;
    this.points += o.points;
    this.fineCount++;
    this.finesTotal += total;
    this.recent.push(rec);
    if (this.recent.length > 50) this.recent.shift();
    return rec;
  }

  /** A flat tax or fee. Returns the amount charged. */
  charge(amount: number, isTax = true): number {
    this.money -= amount;
    if (isTax) this.taxesPaid += amount;
    return amount;
  }

  /** Gross income → itemised German deductions. */
  income(gross: number, label: string): { lines: IncomeLine[]; net: number } {
    const est = round2(gross * 0.42);
    const soli = round2(est * 0.055);
    const kist = round2(est * 0.09);
    const lines: IncomeLine[] = [
      { label, amount: gross },
      { label: 'Einkommensteuer (42 %)', amount: -est },
      { label: 'Solidaritätszuschlag (5,5 % of the tax)', amount: -soli },
      { label: 'Kirchensteuer (9 % of the tax)', amount: -kist },
    ];
    const net = round2(gross - est - soli - kist);
    this.money += net;
    this.taxesPaid += est + soli + kist;
    return { lines, net };
  }

  get broke(): boolean {
    return this.money < 0;
  }

  get licenceRevoked(): boolean {
    return this.points >= MAX_POINTS;
  }

  state(): BureauState {
    return {
      money: this.money,
      points: this.points,
      fineCount: this.fineCount,
      finesTotal: this.finesTotal,
      taxesPaid: this.taxesPaid,
      brakeFluidL: this.brakeFluidL,
      counter: this.counter,
    };
  }

  restore(s: BureauState): void {
    this.money = s.money;
    this.points = s.points;
    this.fineCount = s.fineCount;
    this.finesTotal = s.finesTotal;
    this.taxesPaid = s.taxesPaid;
    this.brakeFluidL = s.brakeFluidL;
    this.counter = s.counter;
  }

  /** The twist: the tax on all the brake fluid you used. */
  brakeFluidTax(): { lines: IncomeLine[]; total: number; years: number } {
    const litres = Math.max(this.brakeFluidL, 0.01);
    const base = round2(litres * 1312.5);
    const late = round2(base * 0.5);
    const interest = round2(base * 0.18);
    const fee = 4711;
    const total = round2(base + late + interest + fee);
    const years = Math.min(12, 2 + Math.round(litres * 3));
    return {
      lines: [
        { label: `Bremsflüssigkeitssteuer: ${litres.toFixed(2)} l DOT-4 × €1.312,50/l`, amount: base },
        { label: 'Säumniszuschlag (late payment surcharge)', amount: late },
        { label: 'Hinterziehungszinsen (evasion interest)', amount: interest },
        { label: 'Bearbeitungsgebühr Steuerfahndung', amount: fee },
      ],
      total,
      years,
    };
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
