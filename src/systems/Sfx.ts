/** Tiny WebAudio synthesiser: no audio files needed. */

class SfxImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private siren: { osc: OscillatorNode; gain: GainNode; timer: number } | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3, delay = 0, slideTo?: number): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.4, freq = 800, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  /** Rubber stamp: THUNK. */
  stamp(): void {
    this.noise(0.12, 0.9, 500);
    this.tone(90, 0.15, 'sine', 0.6, 0, 50);
  }

  /** The signature "NEIN!" sting. */
  nein(): void {
    this.tone(520, 0.12, 'square', 0.18);
    this.tone(390, 0.25, 'square', 0.18, 0.12);
  }

  horn(): void {
    this.tone(415, 0.45, 'sawtooth', 0.18);
    this.tone(523, 0.45, 'sawtooth', 0.14);
  }

  flash(): void {
    this.tone(2400, 0.08, 'sine', 0.2);
    this.noise(0.05, 0.3, 6000, 0.02);
  }

  ok(): void {
    this.tone(660, 0.1, 'triangle', 0.25);
    this.tone(990, 0.18, 'triangle', 0.25, 0.09);
  }

  blinker(on: boolean): void {
    this.tone(on ? 1800 : 1400, 0.025, 'square', 0.06);
  }

  /** The car's seatbelt warning chime. */
  beltChime(): void {
    for (let i = 0; i < 3; i++) this.tone(1320, 0.12, 'sine', 0.2, i * 0.22);
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, i * 0.12));
  }

  whistle(): void {
    this.tone(2200, 0.5, 'sine', 0.2, 0, 2600);
  }

  typewriter(): void {
    this.noise(0.03, 0.25, 3000);
  }

  /** Continuous engine hum; call every frame. */
  engine(speedKmh: number, on: boolean): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (!this.engineOsc) {
      this.engineOsc = c.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = c.createGain();
      this.engineGain.gain.value = 0;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 400;
      this.engineOsc.connect(f).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const gear = speedKmh % 45;
    this.engineOsc.frequency.setTargetAtTime(38 + gear * 2.2 + Math.min(speedKmh, 200) * 0.25, c.currentTime, 0.05);
    this.engineGain!.gain.setTargetAtTime(on ? 0.07 : 0, c.currentTime, 0.1);
  }

  /** German "Tatü-Tata" two-tone siren. */
  setSiren(on: boolean): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (on && !this.siren) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      const gain = c.createGain();
      gain.gain.value = 0.12;
      osc.connect(gain).connect(this.master);
      osc.start();
      let hi = false;
      const timer = window.setInterval(() => {
        hi = !hi;
        osc.frequency.setValueAtTime(hi ? 587 : 440, c.currentTime);
      }, 650);
      this.siren = { osc, gain, timer };
    } else if (!on && this.siren) {
      window.clearInterval(this.siren.timer);
      this.siren.osc.stop();
      this.siren = null;
    }
  }

  sirenVolume(v: number): void {
    if (this.siren && this.ctx) this.siren.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  stopAll(): void {
    this.setSiren(false);
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }
}

export const Sfx = new SfxImpl();
