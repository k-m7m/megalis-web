/**
 * STAGE 1「守護獣の叫び」
 *
 * 迷宮の守護獣が順番に鳴く。光は出ないので、鳴き声だけを頼りに
 * 同じ順番で石像に触れていく音の記憶ゲーム。
 */

import type { BeastId } from './audio';
import type { StageFactory, StageHost, StageInstance } from './types';
import { AbortError, el, isAbortError, randIntAvoid, sleep } from './util';

interface Beast {
  name: string;
  reading: string;
  color: string;
  icon: string;
}

const BEASTS: Beast[] = [
  {
    name: 'ヘビ',
    reading: 'アペプ',
    color: '#5ec27a',
    icon: '<path d="M7 33c5-12 10 6 15-4 5-10 10 8 15-4" /><circle cx="39" cy="22" r="2.6" fill="currentColor" stroke="none" />',
  },
  {
    name: 'コウモリ',
    reading: 'ネフト',
    color: '#a98cf0',
    icon: '<path d="M24 34 16 24 12 29 11 16 18 20 24 13l6 7 7-4-1 13-4-5z" fill="currentColor" stroke="none" />',
  },
  {
    name: 'サソリ',
    reading: 'セルケト',
    color: '#f0b04a',
    icon: '<ellipse cx="21" cy="30" rx="8" ry="5" /><path d="M29 28c8-1 10-7 7-11-3-4-8-1-7 3" /><path d="M14 26 8 20M14 34l-6 5" />',
  },
  {
    name: 'ジャッカル',
    reading: 'アヌビス',
    color: '#7fd6e8',
    icon: '<path d="M17 40V22l-3-11 7 6h8l7-6-3 11v6l-6 12z" fill="currentColor" stroke="none" />',
  },
  {
    name: 'ハヤブサ',
    reading: 'ホルス',
    color: '#f07d7d',
    icon: '<path d="M24 14v20M24 18 8 12l6 12-6 2 16 6M24 18l16-6-6 12 6 2-16 6" />',
  },
  {
    name: 'ワニ',
    reading: 'ソベク',
    color: '#8fae52',
    icon: '<path d="M6 30h30l6-5-6-5H18z" fill="currentColor" stroke="none" /><path d="M18 30l2 5 3-5 3 5 3-5" /><circle cx="30" cy="22" r="2" fill="#0d0b08" stroke="none" />',
  },
];

interface Params {
  startLen: number;
  goalLen: number;
  /** 出題時の 1 音あたりの間隔 (ms) */
  gap: number;
}

const PARAMS: Record<string, Params> = {
  easy: { startLen: 2, goalLen: 4, gap: 680 },
  normal: { startLen: 3, goalLen: 6, gap: 560 },
  hard: { startLen: 3, goalLen: 8, gap: 440 },
};

export const createStage1: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];
  const controller = new AbortController();
  const signal = controller.signal;

  const wrap = el('div', 'mg-stage mg-stage1');
  const listener = el(
    'div',
    'mg-listener',
    '<span class="mg-listener-icon">◟◞</span><span class="mg-listener-text">…</span>',
  );
  const grid = el('div', 'mg-beast-grid');

  const buttons: HTMLButtonElement[] = BEASTS.map((beast, i) => {
    const btn = el('button', 'mg-beast');
    btn.type = 'button';
    btn.style.setProperty('--beast-color', beast.color);
    btn.dataset.index = String(i);
    btn.innerHTML = `
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${beast.icon}</svg>
      <span class="mg-beast-name">${beast.name}</span>
      <span class="mg-beast-reading">${beast.reading}</span>`;
    btn.setAttribute('aria-label', `${beast.name}（${beast.reading}）の石像`);
    grid.appendChild(btn);
    return btn;
  });

  wrap.append(listener, grid);
  root.appendChild(wrap);

  const listenText = listener.querySelector('.mg-listener-text') as HTMLElement;

  let acceptInput = false;
  let pressResolver: ((index: number) => void) | null = null;

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('.mg-beast') as HTMLButtonElement | null;
    if (!btn || !acceptInput) return;
    const index = Number(btn.dataset.index);
    host.audio.beastCry(index as BeastId);
    lightUp(btn, 260);
    pressResolver?.(index);
  };
  grid.addEventListener('click', onClick);

  function lightUp(btn: HTMLElement, ms: number): void {
    btn.classList.add('is-lit');
    window.setTimeout(() => btn.classList.remove('is-lit'), ms);
  }

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

  async function introduce(): Promise<void> {
    host.setStatus('守護獣たちが名乗りを上げる。鳴き声を覚えろ。');
    listenText.textContent = '紹介';
    for (let i = 0; i < BEASTS.length; i += 1) {
      buttons[i].classList.add('is-lit');
      host.audio.beastCry(i as BeastId);
      await sleep(520, signal);
      buttons[i].classList.remove('is-lit');
      await sleep(120, signal);
    }
    await sleep(400, signal);
  }

  async function playSequence(seq: number[]): Promise<void> {
    setEnabled(false);
    listener.classList.add('is-playing');
    listenText.textContent = '出題中';
    host.setStatus('目を閉じて聴け。石像は光らない。');
    await sleep(600, signal);
    for (const id of seq) {
      host.audio.beastCry(id as BeastId);
      await sleep(params.gap, signal);
    }
    listener.classList.remove('is-playing');
    listenText.textContent = 'あなたの番';
    host.setStatus('聴こえた順に石像へ触れろ。');
    setEnabled(true);
  }

  function makeSeq(len: number): number[] {
    const seq: number[] = [];
    for (let i = 0; i < len; i += 1) {
      seq.push(randIntAvoid(BEASTS.length, seq[seq.length - 1] ?? -1));
    }
    return seq;
  }

  async function run(): Promise<boolean> {
    try {
      await introduce();
      let len = params.startLen;
      let seq = makeSeq(len);

      for (;;) {
        host.setMeter(`${len} / ${params.goalLen} 体`);
        await playSequence(seq);

        let ok = true;
        for (let i = 0; i < seq.length; i += 1) {
          const pressed = await waitPress();
          if (pressed !== seq[i]) {
            ok = false;
            break;
          }
          listenText.textContent = `${i + 1} / ${seq.length}`;
        }

        setEnabled(false);

        if (!ok) {
          host.audio.wrong();
          host.flash('bad');
          listenText.textContent = '失敗';
          host.setStatus('叫びがずれた。守護獣が別の順で鳴き直す。');
          const left = host.miss('鳴き声の順番を間違えた');
          if (left <= 0) return false;
          await sleep(1500, signal);
          seq = makeSeq(len);
          continue;
        }

        host.audio.correct();
        host.flash('good');

        if (len >= params.goalLen) {
          host.setStatus('守護獣は道を譲った。');
          host.setMeter(`${params.goalLen} / ${params.goalLen} 体`);
          listenText.textContent = '突破';
          await sleep(800, signal);
          return true;
        }

        listenText.textContent = '正解';
        host.setStatus('正解。守護獣がもう一体加わる。');
        await sleep(950, signal);
        len += 1;
        seq.push(randIntAvoid(BEASTS.length, seq[seq.length - 1]));
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
