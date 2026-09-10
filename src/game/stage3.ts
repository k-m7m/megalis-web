/**
 * STAGE 3「封印の扉」
 *
 * 扉に埋め込まれた 9 枚の石板が順番に光る。音では区別できないので、
 * 光った位置と順番だけを覚えて同じ順になぞる光の記憶ゲーム。
 */

import type { StageFactory, StageHost, StageInstance } from './types';
import { AbortError, el, isAbortError, randIntAvoid, sleep } from './util';

/**
 * 石板に刻まれた紋章。フォントに依存しないよう SVG で描く。
 * 位置を覚えるときの手がかりになる。
 */
const GLYPHS: string[] = [
  '<circle cx="16" cy="16" r="9" />',
  '<path d="M16 6 26 25H6z" />',
  '<rect x="7" y="7" width="18" height="18" rx="2" />',
  '<path d="M16 5v22M5 16h22" />',
  '<path d="M16 4l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />',
  '<path d="M16 25a9 9 0 1 0-9-9 6 6 0 0 0 12 0" />',
  '<path d="M5 20c4-10 7 6 11-4 4-10 7 6 11-4" />',
  '<path d="M4 16c4-6 20-6 24 0-4 6-20 6-24 0z" /><circle cx="16" cy="16" r="3" />',
  '<path d="M16 28V12M9 26h14M16 4a4 4 0 0 1 0 8 4 4 0 0 1 0-8z" />',
];

interface Params {
  startLen: number;
  goalLen: number;
  /** 光っている時間 (ms) */
  on: number;
  /** 消えている時間 (ms) */
  off: number;
}

const PARAMS: Record<string, Params> = {
  easy: { startLen: 2, goalLen: 4, on: 520, off: 280 },
  normal: { startLen: 3, goalLen: 6, on: 400, off: 200 },
  hard: { startLen: 3, goalLen: 8, on: 300, off: 140 },
};

export const createStage3: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];
  const controller = new AbortController();
  const signal = controller.signal;

  const wrap = el('div', 'mg-stage mg-stage3');
  const door = el('div', 'mg-door');
  const grid = el('div', 'mg-slab-grid');

  const buttons: HTMLButtonElement[] = GLYPHS.map((glyph, i) => {
    const btn = el('button', 'mg-slab');
    btn.type = 'button';
    btn.dataset.index = String(i);
    btn.innerHTML = `<svg class="mg-slab-glyph" viewBox="0 0 32 32" aria-hidden="true"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">${glyph}</svg>`;
    btn.setAttribute('aria-label', `石板 ${i + 1}`);
    grid.appendChild(btn);
    return btn;
  });

  const seal = el('div', 'mg-seal', '<span>封 印</span>');
  door.append(grid);
  wrap.append(door, seal);
  root.appendChild(wrap);

  let acceptInput = false;
  let pressResolver: ((index: number) => void) | null = null;

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('.mg-slab') as HTMLButtonElement | null;
    if (!btn || !acceptInput) return;
    host.audio.stoneTap();
    btn.classList.add('is-lit');
    window.setTimeout(() => btn.classList.remove('is-lit'), 180);
    pressResolver?.(Number(btn.dataset.index));
  };
  grid.addEventListener('click', onClick);

  function waitPress(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new AbortError());
        return;
      }
      pressResolver = (index) => {
        pressResolver = null;
        signal.removeEventListener('abort', onAbort);
        resolve(index);
      };
      const onAbort = () => {
        pressResolver = null;
        reject(new AbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function setEnabled(on: boolean): void {
    acceptInput = on;
    grid.classList.toggle('is-active', on);
    for (const b of buttons) b.disabled = !on;
  }

  function makeSeq(len: number): number[] {
    const seq: number[] = [];
    for (let i = 0; i < len; i += 1) {
      seq.push(randIntAvoid(GLYPHS.length, seq[seq.length - 1] ?? -1));
    }
    return seq;
  }

  async function playSequence(seq: number[]): Promise<void> {
    setEnabled(false);
    seal.classList.add('is-playing');
    host.setStatus('石板の光る順番を見ろ。');
    await sleep(650, signal);
    for (const id of seq) {
      buttons[id].classList.add('is-lit');
      host.audio.stoneGlow();
      await sleep(params.on, signal);
      buttons[id].classList.remove('is-lit');
      await sleep(params.off, signal);
    }
    seal.classList.remove('is-playing');
    host.setStatus('同じ順番で石板を押せ。');
    setEnabled(true);
  }

  async function run(): Promise<boolean> {
    try {
      let len = params.startLen;
      let seq = makeSeq(len);

      for (;;) {
        host.setMeter(`${len} / ${params.goalLen} 枚`);
        await playSequence(seq);

        let ok = true;
        for (let i = 0; i < seq.length; i += 1) {
          const pressed = await waitPress();
          if (pressed !== seq[i]) {
            ok = false;
            break;
          }
        }

        setEnabled(false);

        if (!ok) {
          host.audio.wrong();
          host.flash('bad');
          door.classList.add('is-shaking');
          window.setTimeout(() => door.classList.remove('is-shaking'), 600);
          host.setStatus('封印が押し返した。石板の並びが変わる。');
          const left = host.miss('石板の順番を間違えた');
          if (left <= 0) return false;
          await sleep(1500, signal);
          seq = makeSeq(len);
          continue;
        }

        host.audio.correct();
        host.flash('good');

        if (len >= params.goalLen) {
          seal.classList.add('is-broken');
          host.setStatus('封印が砕けた。扉が開く。');
          host.setMeter(`${params.goalLen} / ${params.goalLen} 枚`);
          await sleep(900, signal);
          return true;
        }

        host.setStatus('正解。封印がひとつ深くなる。');
        await sleep(950, signal);
        len += 1;
        seq.push(randIntAvoid(GLYPHS.length, seq[seq.length - 1]));
      }
    } catch (e) {
      if (isAbortError(e)) return false;
      throw e;
    }
  }

  return {
    run,
    dispose(): void {
      controller.abort();
      grid.removeEventListener('click', onClick);
      wrap.remove();
    },
  };
};
