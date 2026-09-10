/**
 * 電脳迷宮メガリス - 効果音エンジン
 *
 * 効果音は Web Audio API のオシレータとノイズだけで合成する。
 * 音源ファイルは同梱していないので、すべてオリジナルの音になる。
 *
 * 守護獣の鳴き声だけは例外で、public/sounds/ に実音源を置けば
 * そちらが優先される。置かれていなければ合成音で代用する。
 * 合成側も、実際の鳴き方（雑音・摩擦音・倍音のある声）に寄せてある。
 *
 * 鳴き声どうしの音量と音域は、聴き分けやすさを保つために
 * そろえてある。極端にずれると特定の獣だけ覚えやすくなってしまう。
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
  /** 立ち上がり (秒) */
  attack?: number;
  filter?: BiquadFilterType;
  f0?: number;
  f1?: number;
  q?: number;
}

/**
 * public/sounds/manifest.json の形。
 * 守護獣の番号（0〜5）に音声ファイル名を対応させる。
 *
 * 例: { "0": "snake.webm", "3": "jackal.webm" }
 *
 * 書かれていない番号は合成音のままになるので、用意できたものから
 * 少しずつ差し替えられる。
 */
type SoundManifest = Record<string, string>;

const MASTER_LEVEL = 0.28;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  /** 実音源が読み込めた守護獣の番号 → 音声データ */
  private samples = new Map<number, AudioBuffer>();
  private samplesRequested = false;

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
    void this.loadBeastSamples();
  }

  /**
   * public/sounds/manifest.json があれば、そこに書かれた音声ファイルを読み込む。
   *
   * 音源が置かれていなければ何もせず、鳴き声は合成音のままになる。
   * 実音源を用意できたときにファイルを置くだけで差し替わるようにしてある。
   */
  private async loadBeastSamples(): Promise<void> {
    if (this.samplesRequested) return;
    this.samplesRequested = true;

    const ctx = this.ctx;
    if (!ctx) return;

    const base = import.meta.env.BASE_URL;
    let manifest: SoundManifest;
    try {
      const res = await fetch(`${base}sounds/manifest.json`);
      if (!res.ok) return; // 音源未配置。合成音で動かす
      manifest = (await res.json()) as SoundManifest;
    } catch {
      return;
    }

    await Promise.all(
      Object.entries(manifest).map(async ([key, file]) => {
        const id = Number(key);
        if (!Number.isInteger(id) || id < 0 || id > 5) return;
        try {
          const res = await fetch(`${base}sounds/${file}`);
          if (!res.ok) return;
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.samples.set(id, buf);
        } catch {
          // 1 つ読めなくても他は活かす。読めなかった分は合成音になる
        }
      }),
    );
  }

  /** 実音源があれば鳴らす。鳴らせたら true */
  private playSample(id: BeastId): boolean {
    const ctx = this.ctx;
    const master = this.master;
    const buf = this.samples.get(id);
    if (!ctx || !master || !buf) return false;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    src.start(ctx.currentTime);
    return true;
  }

  /** その守護獣の音が実音源かどうか（画面に出す表示の判断に使う） */
  hasSample(id: BeastId): boolean {
    return this.samples.has(id);
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

    const attack = Math.min(o.attack ?? 0.01, dur * 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
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

  /**
   * 声帯を模した音を作る。
   * 基音とその倍音を重ね、共鳴（フォルマント）で色付けし、
   * 細かい振幅の揺れで「かすれ」を足す。動物の声はこれで大きく近づく。
   */
  private voice(o: {
    /** 基音の始まり (Hz) */
    f0: number;
    /** 基音の終わり (Hz) */
    f1?: number;
    dur: number;
    gain?: number;
    at?: number;
    attack?: number;
    /** 重ねる倍音の数 */
    partials?: number;
    /** 共鳴させる周波数。動物ごとの「声色」を決める */
    formants?: number[];
    /** 声のざらつき。1 秒あたりの揺れ回数 */
    roughness?: number;
    /** ざらつきの深さ (0..1) */
    roughDepth?: number;
    /** 息の混ざり具合 (0..1) */
    breath?: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t0 = ctx.currentTime + (o.at ?? 0);
    const dur = o.dur;
    const peak = o.gain ?? 0.3;
    const attack = Math.min(o.attack ?? 0.02, dur * 0.4);
    const partials = o.partials ?? 6;
    const f1 = o.f1 ?? o.f0;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    out.gain.setValueAtTime(peak, t0 + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    // 共鳴。指定がなければ素通し
    let entry: AudioNode = out;
    if (o.formants && o.formants.length > 0) {
      const merge = ctx.createGain();
      for (const f of o.formants) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.value = f;
        bp.Q.value = 6;
        bp.gain.value = 12;
        merge.connect(bp);
        bp.connect(out);
      }
      // 共鳴を通さない素の成分も少し残す
      const dry = ctx.createGain();
      dry.gain.value = 0.35;
      merge.connect(dry);
      dry.connect(out);
      entry = merge;
    }

    // 倍音を積む。上の倍音ほど小さく
    for (let n = 1; n <= partials; n += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(o.f0 * n, t0);
      if (f1 !== o.f0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(f1 * n, 1), t0 + dur);
      }
      const g = ctx.createGain();
      g.gain.value = 0.5 / (n * n);
      osc.connect(g);
      g.connect(entry);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    // ざらつき。振幅を細かく揺らすと唸り声らしくなる
    if (o.roughness) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = o.roughness;
      lfoGain.gain.value = (o.roughDepth ?? 0.4) * peak;
      lfo.connect(lfoGain);
      lfoGain.connect(out.gain);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }

    // 息の成分
    if (o.breath) {
      this.noise({
        dur,
        at: o.at ?? 0,
        gain: peak * o.breath,
        filter: 'bandpass',
        f0: Math.max(o.f0 * 3, 600),
        q: 0.8,
      });
    }

    out.connect(master);
  }

  /**
   * 守護獣の鳴き声。
   *
   * 実音源のファイルが読み込まれていればそちらを鳴らし、
   * 無ければ合成音で代用する。合成側は実際の鳴き方に寄せてある。
   */
  beastCry(id: BeastId): void {
    if (this.playSample(id)) return;

    switch (id) {
      // ヘビ: 帯域の広い息の音。実際の威嚇音はほぼ雑音そのものなので再現しやすい
      case 0:
        this.noise({ dur: 0.85, gain: 0.62, attack: 0.08, filter: 'bandpass', f0: 3800, q: 0.7 });
        this.noise({ dur: 0.85, gain: 0.34, attack: 0.1, filter: 'highpass', f0: 5200 });
        break;
      // コウモリ: 耳に聞こえる社会音。短いキーッを数回。
      // サソリと紛れないよう、はっきり高い音域に置く
      case 1:
        for (let i = 0; i < 5; i += 1) {
          this.osc({
            type: 'sawtooth',
            f0: 6200 - i * 200,
            f1: 4000,
            dur: 0.045,
            gain: 0.62,
            at: i * 0.075,
            attack: 0.004,
          });
        }
        break;
      // サソリ: 体をこすり合わせる摩擦音。乾いた連続のザラザラ。
      // コウモリと紛れないよう、低めの帯域に寄せる
      case 2:
        for (let i = 0; i < 14; i += 1) {
          this.noise({
            dur: 0.028,
            gain: 1.5,
            at: i * 0.035,
            filter: 'bandpass',
            f0: 850 + (i % 2) * 450,
            q: 1.4,
          });
        }
        break;
      // ジャッカル: 犬科の遠吠え。倍音と共鳴で声らしさを出す
      case 3:
        this.voice({
          f0: 420,
          f1: 560,
          dur: 0.75,
          gain: 0.24,
          attack: 0.09,
          partials: 9,
          formants: [900, 2100],
          roughness: 6,
          roughDepth: 0.12,
          breath: 0.1,
        });
        break;
      // ハヤブサ: 一声で伸ばすのではなく、鋭い声を細かく連ねるのが実際に近い
      case 4:
        for (let i = 0; i < 5; i += 1) {
          this.voice({
            f0: 1250,
            f1: 950,
            dur: 0.075,
            gain: 0.2,
            at: i * 0.105,
            attack: 0.006,
            partials: 5,
            formants: [2600, 4200],
            breath: 0.35,
          });
        }
        break;
      // ワニ: 腹に響く咆哮。低い基音を粗く震わせる
      case 5:
        this.voice({
          f0: 78,
          f1: 62,
          dur: 0.9,
          gain: 0.22,
          attack: 0.06,
          partials: 12,
          formants: [240, 620],
          roughness: 26,
          roughDepth: 0.45,
          breath: 0.12,
        });
        break;
    }
  }

  /** ダイヤルが 1 目盛り動いたときのカチッという手応え */
  dialClick(): void {
    this.noise({ dur: 0.018, gain: 0.22, filter: 'bandpass', f0: 2600, q: 6 });
    this.osc({ type: 'square', f0: 1400, f1: 900, dur: 0.022, gain: 0.09 });
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
