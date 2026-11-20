/** In-game clock with German quiet-time rules. Pure module. */

export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;

export class Clock {
  /** 0 = Monday ... 6 = Sunday */
  day = 0;
  /** Minutes since midnight (fractional). */
  minutes = 8 * 60;
  /** Game minutes per real second. */
  rate = 1;
  /** Multiplier while the player waits (Z). */
  waitRate = 6;
  waiting = false;

  advance(dtSec: number): void {
    this.minutes += dtSec * this.rate * (this.waiting ? this.waitRate : 1);
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day = (this.day + 1) % 7;
    }
  }

  set(day: number, hour: number, minute = 0): void {
    this.day = day;
    this.minutes = hour * 60 + minute;
  }

  get hour(): number {
    return Math.floor(this.minutes / 60);
  }

  get isSunday(): boolean {
    return this.day === 6;
  }

  get isMittagsruhe(): boolean {
    return this.minutes >= 13 * 60 && this.minutes < 15 * 60;
  }

  get isNachtruhe(): boolean {
    return this.minutes >= 22 * 60 || this.minutes < 6 * 60;
  }

  /** Sundays, Mittagsruhe and Nachtruhe: no noise. */
  get isQuietTime(): boolean {
    return this.isSunday || this.isMittagsruhe || this.isNachtruhe;
  }

  get isNight(): boolean {
    return this.minutes >= 21 * 60 || this.minutes < 6 * 60;
  }

  /** Glass containers: Mo–Sa 08–13 and 15–19 only. */
  get glassAllowed(): boolean {
    if (this.day === 6) return false;
    const m = this.minutes;
    return (m >= 8 * 60 && m < 13 * 60) || (m >= 15 * 60 && m < 19 * 60);
  }

  quietLabel(): string {
    if (this.isSunday) return 'Sonntagsruhe';
    if (this.isNachtruhe) return 'Nachtruhe';
    if (this.isMittagsruhe) return 'Mittagsruhe';
    return '';
  }

  format(): string {
    const h = Math.floor(this.minutes / 60);
    const mm = Math.floor(this.minutes % 60);
    return `${DAYS[this.day]} ${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  static hm(h: number, m = 0): number {
    return h * 60 + m;
  }
}
