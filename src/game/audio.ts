/**
 * 電脳迷宮メガリス - 効果音エンジン
 *
 * 音源ファイルは一切使わず、Web Audio API のオシレータとノイズだけで
 * すべての音を合成する。守護獣の鳴き声も含めてすべてオリジナル。
 */

export type BeastId = 0 | 1 | 2 | 3 | 4 | 5;

interface OscOptions {
  type: OscillatorType;
  /** 開始周波数 (Hz) */
  f0: number;
  /** 終了周波数 (Hz)。省略時は f0 のまま */
  f1?: number;
  /** 長さ (秒) */
  dur: number;
  /** 音量 (0..1) */
  gain?: number;
  /** 発音開始までの遅延 (秒) */
  at?: number;
  /** 立ち上がり (秒) */
  attack?: number;
  /** ビブラートの深さ (Hz)。0 なし */
  vibrato?: number;
  /** ビブラートの速さ (Hz) */
  vibratoRate?: number;
}

interface NoiseOptions {
  dur: number;
  gain?: number;
  at?: number;
  filter?: BiquadFilterType;
  f0?: number;
  f1?: number;
  q?: number;
}

const MASTER_LEVEL = 0.28;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  /** ユーザー操作の中から呼ぶこと。ブラウザの自動再生制限を解除する。 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : MASTER_LEVEL,
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private osc(o: OscOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t0 = ctx.currentTime + (o.at ?? 0);
    const dur = o.dur;
    const peak = o.gain ?? 0.4;
    const attack = Math.min(o.attack ?? 0.008, dur * 0.5);

    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined && o.f1 !== o.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t0 + dur);
    }

    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = o.vibratoRate ?? 18;
      lfoGain.gain.value = o.vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(o: NoiseOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t0 = ctx.currentTime + (o.at ?? 0);
    const dur = o.dur;
    const peak = o.gain ?? 0.3;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.01, dur * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let tail: AudioNode = src;
    if (o.filter) {
      const biquad = ctx.createBiquadFilter();
      biquad.type = o.filter;
      biquad.Q.value = o.q ?? 1;
      biquad.frequency.setValueAtTime(o.f0 ?? 1000, t0);
      if (o.f1 !== undefined) {
        biquad.frequency.exponentialRampToValueAtTime(
          Math.max(o.f1, 1),
          t0 + dur,
        );
      }
      src.connect(biquad);
      tail = biquad;
    }

    tail.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** 守護獣の鳴き声。6 種すべて音色が異なる。 */
  beastCry(id: BeastId): void {
    switch (id) {
      // ヘビ: 息の抜けるようなシューという音
      case 0:
        this.noise({ dur: 0.55, gain: 0.22, filter: 'bandpass', f0: 5200, f1: 2600, q: 1.4 });
        this.noise({ dur: 0.5, gain: 0.1, at: 0.06, filter: 'highpass', f0: 3000 });
        break;
      // コウモリ: 高くて速いチチチという鳴き声
      case 1:
        for (let i = 0; i < 4; i += 1) {
          this.osc({ type: 'sine', f0: 4200, f1: 2200, dur: 0.06, gain: 0.3, at: i * 0.085 });
        }
        break;
      // サソリ: カチカチと硬い連打音
      case 2:
        for (let i = 0; i < 7; i += 1) {
          this.noise({ dur: 0.03, gain: 0.26, at: i * 0.055, filter: 'bandpass', f0: 2000, q: 8 });
        }
        break;
      // ジャッカル: 尻上がりに伸びる遠吠え
      case 3:
        this.osc({ type: 'sawtooth', f0: 300, f1: 540, dur: 0.5, gain: 0.16, attack: 0.06, vibrato: 12, vibratoRate: 7 });
        this.osc({ type: 'triangle', f0: 600, f1: 1080, dur: 0.5, gain: 0.06, attack: 0.06 });
        break;
      // ハヤブサ: 鋭く落ちる金切り声
      case 4:
        this.osc({ type: 'triangle', f0: 1700, f1: 800, dur: 0.34, gain: 0.22, vibrato: 90, vibratoRate: 26 });
        break;
      // ワニ: 腹に響く低いうなり
      case 5:
        this.osc({ type: 'sawtooth', f0: 92, f1: 62, dur: 0.6, gain: 0.3, attack: 0.05 });
        this.noise({ dur: 0.6, gain: 0.09, filter: 'lowpass', f0: 420, f1: 200 });
        break;
    }
  }

  /** 石板を押した音。どのタイルでも同じ音（音で位置が分からないように） */
  stoneTap(): void {
    this.noise({ dur: 0.08, gain: 0.16, filter: 'bandpass', f0: 900, q: 2 });
    this.osc({ type: 'sine', f0: 220, f1: 160, dur: 0.1, gain: 0.12 });
  }

  /** 石板が光る音 */
  stoneGlow(): void {
    this.osc({ type: 'sine', f0: 660, dur: 0.16, gain: 0.14 });
    this.osc({ type: 'sine', f0: 990, dur: 0.16, gain: 0.05 });
  }

  uiClick(): void {
    this.osc({ type: 'square', f0: 520, dur: 0.05, gain: 0.1 });
  }

  launch(): void {
    this.osc({ type: 'square', f0: 180, f1: 720, dur: 0.14, gain: 0.16 });
  }

  peg(): void {
    this.osc({ type: 'square', f0: 1500, dur: 0.03, gain: 0.07 });
  }

  wall(): void {
    this.osc({ type: 'sine', f0: 300, dur: 0.05, gain: 0.06 });
  }

  pocket(): void {
    this.osc({ type: 'sine', f0: 880, dur: 0.09, gain: 0.18 });
    this.osc({ type: 'sine', f0: 1320, dur: 0.12, gain: 0.14, at: 0.08 });
  }

  correct(): void {
    this.osc({ type: 'triangle', f0: 784, dur: 0.1, gain: 0.2 });
    this.osc({ type: 'triangle', f0: 1046, dur: 0.16, gain: 0.2, at: 0.09 });
  }

  wrong(): void {
    this.osc({ type: 'sawtooth', f0: 190, f1: 70, dur: 0.5, gain: 0.22 });
    this.noise({ dur: 0.35, gain: 0.12, filter: 'lowpass', f0: 800, f1: 200 });
  }

  /** イライラ棒で壁に触れた瞬間の警報 */
  zap(): void {
    this.noise({ dur: 0.22, gain: 0.26, filter: 'bandpass', f0: 3000, f1: 700, q: 3 });
    this.osc({ type: 'square', f0: 900, f1: 120, dur: 0.25, gain: 0.16 });
  }

  tick(): void {
    this.osc({ type: 'sine', f0: 1200, dur: 0.03, gain: 0.06 });
  }

  stageClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.osc({ type: 'triangle', f0: f, dur: 0.28, gain: 0.2, at: i * 0.13 });
    });
  }

  gameOver(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => {
      this.osc({ type: 'sawtooth', f0: f, dur: 0.42, gain: 0.16, at: i * 0.22 });
    });
  }

  /** 全ステージ突破のファンファーレ */
  fanfare(): void {
    const seq: Array<[number, number]> = [
      [523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36],
      [987.77, 0.62], [1046.5, 0.74],
    ];
    for (const [f, at] of seq) {
      this.osc({ type: 'triangle', f0: f, dur: 0.34, gain: 0.2, at });
      this.osc({ type: 'sine', f0: f * 2, dur: 0.34, gain: 0.06, at });
    }
    this.osc({ type: 'sine', f0: 130.81, dur: 1.3, gain: 0.14, at: 0.36 });
  }
}
