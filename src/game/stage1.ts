/**
 * STAGE 1「守護獣の叫び」
 *
 * 迷宮の守護獣が順番に鳴く。光は出ないので、鳴き声だけを頼りに
 * 同じ順番で石像を選んでいく音の記憶ゲーム。
 *
 * 選択は実機と同じくダイヤル式。カチカチと回して守護獣を合わせ、
 * 扉のボタンを押して確定する。回している間は鳴き声が出ないので、
 * 回しながら音を聴き比べて答えを探ることはできない。
 */

import type { BeastId } from './audio';
import type { StageFactory, StageHost, StageInstance } from './types';
import { AbortError, el, isAbortError, randIntAvoid, sleep } from './util';

interface Beast {
  name: string;
  reading: string;
  color: string;
  /** 0 0 48 48 の座標系で描いた紋章 */
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

/** ダイヤルの目盛りの間隔（度） */
const STEP = 360 / BEASTS.length;

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

  // --- 画面の組み立て ---------------------------------------------------
  const wrap = el('div', 'mg-stage mg-stage1');

  const listener = el(
    'div',
    'mg-listener',
    '<span class="mg-listener-icon">◟◞</span><span class="mg-listener-text">…</span>',
  );

  const dialWrap = el('div', 'mg-dial-wrap');
  dialWrap.innerHTML = `
    <div class="mg-dial-marker" aria-hidden="true"></div>
    <svg class="mg-dial" viewBox="0 0 240 240" role="group" aria-label="守護獣を選ぶダイヤル">
      <circle class="mg-dial-rim" cx="120" cy="120" r="116" />
      <g class="mg-dial-face">
        <circle class="mg-dial-plate" cx="120" cy="120" r="108" />
        ${BEASTS.map((beast, i) => {
          const angle = i * STEP;
          return `
            <g class="mg-dial-slot" data-index="${i}" transform="rotate(${angle} 120 120)"
               style="--beast-color: ${beast.color}">
              <circle class="mg-dial-notch" cx="120" cy="20" r="3" />
              <g transform="translate(96 26)">
                <svg class="mg-dial-icon" x="0" y="0" width="48" height="48" viewBox="0 0 48 48"
                     fill="none" stroke="currentColor" stroke-width="2.4"
                     stroke-linecap="round" stroke-linejoin="round">${beast.icon}</svg>
              </g>
            </g>`;
        }).join('')}
      </g>
      <circle class="mg-dial-knob" cx="120" cy="120" r="42" />
      <g class="mg-dial-grip">
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 120 + Math.cos(a) * 34;
          const y1 = 120 + Math.sin(a) * 34;
          const x2 = 120 + Math.cos(a) * 41;
          const y2 = 120 + Math.sin(a) * 41;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
        }).join('')}
      </g>
    </svg>
  `;

  const readout = el('div', 'mg-dial-readout');
  const doorBtn = el('button', 'mg-door-btn');
  doorBtn.type = 'button';
  doorBtn.innerHTML = '<span class="mg-door-btn-label">扉を叩く</span>';

  wrap.append(listener, dialWrap, readout, doorBtn);
  root.appendChild(wrap);

  const listenText = listener.querySelector('.mg-listener-text') as HTMLElement;
  const dialSvg = dialWrap.querySelector('.mg-dial') as SVGSVGElement;
  const dialFace = dialWrap.querySelector('.mg-dial-face') as SVGGElement;
  const slots = Array.from(
    dialWrap.querySelectorAll('.mg-dial-slot'),
  ) as SVGGElement[];

  // --- ダイヤルの状態 ---------------------------------------------------
  /** ダイヤルの回転角（度）。0 のとき守護獣 0 が印の位置に来る */
  let rotation = 0;
  let selected = 0;
  /** 入力を受け付けているか */
  let acceptInput = false;
  let dragging = false;
  let dragStartAngle = 0;
  let dragStartRotation = 0;

  /** 扉のボタンが押されたときに答えを受け取る先 */
  let commitResolver: ((index: number) => void) | null = null;

  function selectedFromRotation(r: number): number {
    const idx = Math.round(-r / STEP) % BEASTS.length;
    return (idx + BEASTS.length) % BEASTS.length;
  }

  function renderDial(animate: boolean): void {
    dialFace.style.transition = animate ? 'transform 0.16s ease-out' : 'none';
    dialFace.style.transform = `rotate(${rotation}deg)`;
    for (let i = 0; i < slots.length; i += 1) {
      slots[i].classList.toggle('is-selected', i === selected);
    }
    const beast = BEASTS[selected];
    readout.innerHTML = `
      <span class="mg-dial-readout-name" style="color:${beast.color}">${beast.name}</span>
      <span class="mg-dial-readout-reading">${beast.reading}</span>`;
  }

  /** 回転角を変え、目盛りをまたいだらカチッと鳴らす */
  function setRotation(next: number, animate: boolean): void {
    rotation = next;
    const nextSelected = selectedFromRotation(rotation);
    if (nextSelected !== selected) {
      selected = nextSelected;
      host.audio.dialClick();
      dialWrap.classList.remove('is-clicked');
      void dialWrap.offsetWidth;
      dialWrap.classList.add('is-clicked');
    }
    renderDial(animate);
  }

  /** 目盛りちょうどの角度に吸い付かせる */
  function snap(): void {
    setRotation(-selected * STEP, true);
  }

  function stepBy(dir: number): void {
    if (!acceptInput) return;
    setRotation(rotation - dir * STEP, true);
  }

  function pointerAngle(e: PointerEvent): number {
    const rect = dialSvg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!acceptInput) return;
    host.audio.unlock();
    dragging = true;
    dragStartAngle = pointerAngle(e);
    dragStartRotation = rotation;
    dialSvg.setPointerCapture(e.pointerId);
    dialWrap.classList.add('is-dragging');
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    let delta = pointerAngle(e) - dragStartAngle;
    // -180〜180 に畳んで、一周をまたいだときに飛ばないようにする
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    setRotation(dragStartRotation + delta, false);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (dialSvg.hasPointerCapture(e.pointerId)) {
      dialSvg.releasePointerCapture(e.pointerId);
    }
    dialWrap.classList.remove('is-dragging');
    snap();
  };

  const onWheel = (e: WheelEvent) => {
    if (!acceptInput) return;
    e.preventDefault();
    stepBy(e.deltaY > 0 ? 1 : -1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!acceptInput) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stepBy(-1);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  /** 目盛りを直接押したときは、そこまで回してから確定はしない */
  const onSlotClick = (e: Event) => {
    if (!acceptInput || dragging) return;
    const slot = (e.target as Element).closest('.mg-dial-slot') as SVGGElement | null;
    if (!slot) return;
    const index = Number(slot.dataset.index);
    if (index === selected) return;
    // 今の位置から一番近い回り方で合わせる
    let diff = (selected - index) * STEP;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    setRotation(rotation + diff, true);
  };

  function commit(): void {
    if (!acceptInput) return;
    host.audio.unlock();
    doorBtn.classList.remove('is-pressed');
    void doorBtn.offsetWidth;
    doorBtn.classList.add('is-pressed');
    host.audio.beastCry(selected as BeastId);
    commitResolver?.(selected);
  }

  dialSvg.addEventListener('pointerdown', onPointerDown);
  dialSvg.addEventListener('pointermove', onPointerMove);
  dialSvg.addEventListener('pointerup', onPointerUp);
  dialSvg.addEventListener('pointercancel', onPointerUp);
  dialSvg.addEventListener('click', onSlotClick);
  dialSvg.addEventListener('wheel', onWheel, { passive: false });
  doorBtn.addEventListener('click', commit);
  window.addEventListener('keydown', onKeyDown);

  function waitCommit(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new AbortError());
        return;
      }
      commitResolver = (index) => {
        commitResolver = null;
        signal.removeEventListener('abort', onAbort);
        resolve(index);
      };
      const onAbort = () => {
        commitResolver = null;
        reject(new AbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function setEnabled(on: boolean): void {
    acceptInput = on;
    wrap.classList.toggle('is-active', on);
    doorBtn.disabled = !on;
  }

  // --- 進行 -------------------------------------------------------------
  async function introduce(): Promise<void> {
    host.setStatus('守護獣たちが名乗りを上げる。鳴き声を覚えろ。');
    listenText.textContent = '紹介';
    for (let i = 0; i < BEASTS.length; i += 1) {
      setRotation(-i * STEP, true);
      host.audio.beastCry(i as BeastId);
      await sleep(700, signal);
    }
    setRotation(0, true);
    await sleep(400, signal);
  }

  async function playSequence(seq: number[]): Promise<void> {
    setEnabled(false);
    listener.classList.add('is-playing');
    listenText.textContent = '出題中';
    host.setStatus('目を閉じて聴け。ダイヤルは動かない。');
    await sleep(600, signal);
    for (const id of seq) {
      host.audio.beastCry(id as BeastId);
      await sleep(params.gap, signal);
    }
    listener.classList.remove('is-playing');
    listenText.textContent = 'あなたの番';
    host.setStatus('ダイヤルを回して合わせ、扉を叩いて答えろ。');
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
      renderDial(false);
      await introduce();
      let len = params.startLen;
      let seq = makeSeq(len);

      for (;;) {
        host.setMeter(`${len} / ${params.goalLen} 体`);
        await playSequence(seq);

        let ok = true;
        for (let i = 0; i < seq.length; i += 1) {
          const answered = await waitCommit();
          if (answered !== seq[i]) {
            ok = false;
            break;
          }
          listenText.textContent = `${i + 1} / ${seq.length}`;
          // 鳴き声と次の入力が重ならないように少し待つ
          await sleep(260, signal);
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
      dialSvg.removeEventListener('pointerdown', onPointerDown);
      dialSvg.removeEventListener('pointermove', onPointerMove);
      dialSvg.removeEventListener('pointerup', onPointerUp);
      dialSvg.removeEventListener('pointercancel', onPointerUp);
      dialSvg.removeEventListener('click', onSlotClick);
      dialSvg.removeEventListener('wheel', onWheel);
      doorBtn.removeEventListener('click', commit);
      window.removeEventListener('keydown', onKeyDown);
      wrap.remove();
    },
  };
};
