/**
 * STAGE 3「封印の扉」
 *
 * 扉に埋め込まれた 9 枚の石板が順番に光る。音では区別できないので、
 * 光った位置と順番だけを覚えて同じ順になぞる光の記憶ゲーム。
 *
 * 見た目は実機と同じく、壁をくり抜いた石造りの祭室。
 * 左右の柱にアヌビスとファラオが浮き彫りで立ち、奥の壁に石板が並ぶ。
 */

import { ANUBIS, PHARAOH, WINGED_DISC } from './reliefs';
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

// --- 扉の寸法。すべて viewBox 320 x 332 の中の座標 -----------------------
const VB_W = 320;
const VB_H = 332;
/** まぐさ石 */
const LINTEL_Y = 52;
const LINTEL_H = 32;
/** 左右の柱 */
const JAMB_W = 62;
const DOOR_X = 14;
const DOOR_W = VB_W - DOOR_X * 2;
/** 奥の祭室 */
const ROOM_X = DOOR_X + JAMB_W;
const ROOM_W = DOOR_W - JAMB_W * 2;
const ROOM_Y = LINTEL_Y + LINTEL_H;
const ROOM_H = 206;
/** 石板の並び */
const PAD = 12;
const GAP = 7;
const CELL_W = (ROOM_W - PAD * 2 - GAP * 2) / 3;
const CELL_H = (ROOM_H - PAD * 2 - GAP * 2) / 3;

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

/** 壁面の彫り込み。意味のない飾りなので軽く散らす */
function carvedWall(): string {
  const marks: string[] = [];
  for (let row = 0; row < 9; row += 1) {
    const y = 16 + row * 36;
    for (const x of [10, 310]) {
      marks.push(
        `<rect class="mg-wall-mark" x="${x - 5}" y="${y}" width="10" height="8" rx="1" />`,
      );
    }
  }
  // 石積みの目地
  for (let i = 1; i < 8; i += 1) {
    marks.push(
      `<line class="mg-wall-course" x1="0" y1="${i * 44}" x2="${VB_W}" y2="${i * 44}" />`,
    );
  }
  return marks.join('');
}

function slabMarkup(): string {
  return GLYPHS.map((glyph, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = ROOM_X + PAD + col * (CELL_W + GAP);
    const y = ROOM_Y + PAD + row * (CELL_H + GAP);
    const gx = x + CELL_W / 2 - 16;
    const gy = y + CELL_H / 2 - 16;
    return `
      <g class="mg-slab" data-index="${i}" role="button" aria-label="石板 ${i + 1}">
        <rect class="mg-slab-face" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
              width="${CELL_W.toFixed(1)}" height="${CELL_H.toFixed(1)}" rx="3" />
        <svg class="mg-slab-glyph" x="${gx.toFixed(1)}" y="${gy.toFixed(1)}"
             width="32" height="32" viewBox="0 0 32 32"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
      </g>`;
  }).join('');
}

export const createStage3: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];
  const controller = new AbortController();
  const signal = controller.signal;

  const wrap = el('div', 'mg-stage mg-stage3');
  const scene = el('div', 'mg-door-scene');

  scene.innerHTML = `
    <svg viewBox="0 0 ${VB_W} ${VB_H}" class="mg-door-svg"
         role="group" aria-label="封印の扉">
      <defs>
        <linearGradient id="mg-wall-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6b5636" />
          <stop offset="55%" stop-color="#54432a" />
          <stop offset="100%" stop-color="#3d301e" />
        </linearGradient>
        <linearGradient id="mg-jamb-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#7d6540" />
          <stop offset="60%" stop-color="#5f4c30" />
          <stop offset="100%" stop-color="#43351f" />
        </linearGradient>
        <radialGradient id="mg-room-grad" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0%" stop-color="#241d2e" />
          <stop offset="100%" stop-color="#0c0910" />
        </radialGradient>
      </defs>

      <!-- 砂岩の壁 -->
      <rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="url(#mg-wall-grad)" />
      ${carvedWall()}

      <!-- まぐさ石の上の有翼日輪。封印の状態をここで示す -->
      <g class="mg-winged-disc" transform="translate(80 12)">${WINGED_DISC}</g>

      <!-- まぐさ石 -->
      <rect class="mg-lintel" x="${DOOR_X - 8}" y="${LINTEL_Y}"
            width="${DOOR_W + 16}" height="${LINTEL_H}" rx="2" />

      <!-- 奥の祭室 -->
      <rect x="${ROOM_X}" y="${ROOM_Y}" width="${ROOM_W}" height="${ROOM_H}"
            fill="url(#mg-room-grad)" />

      <!-- 左右の柱 -->
      <rect class="mg-jamb" x="${DOOR_X}" y="${ROOM_Y}"
            width="${JAMB_W}" height="${ROOM_H}" fill="url(#mg-jamb-grad)" />
      <rect class="mg-jamb" x="${ROOM_X + ROOM_W}" y="${ROOM_Y}"
            width="${JAMB_W}" height="${ROOM_H}" fill="url(#mg-jamb-grad)" />

      <!-- 守護者。左にアヌビス、右にファラオ -->
      <g class="mg-relief" transform="translate(${DOOR_X + 5} ${ROOM_Y + 6}) scale(1.3)">
        ${ANUBIS}
      </g>
      <g class="mg-relief" transform="translate(${ROOM_X + ROOM_W + 5} ${ROOM_Y + 6}) scale(1.3)">
        ${PHARAOH}
      </g>

      <!-- 祭室の縁。柱より手前に置いて奥まって見せる -->
      <rect class="mg-room-edge" x="${ROOM_X}" y="${ROOM_Y}"
            width="${ROOM_W}" height="${ROOM_H}" />

      <!-- 石板 -->
      ${slabMarkup()}

      <!-- 基壇 -->
      <rect class="mg-plinth" x="8" y="${ROOM_Y + ROOM_H}"
            width="${VB_W - 16}" height="18" rx="2" />
      <rect class="mg-plinth" x="0" y="${ROOM_Y + ROOM_H + 18}"
            width="${VB_W}" height="20" rx="2" />
    </svg>
  `;

  const seal = el('div', 'mg-seal', '<span>封 印</span>');
  wrap.append(scene, seal);
  root.appendChild(wrap);

  const svg = scene.querySelector('.mg-door-svg') as SVGSVGElement;
  const disc = scene.querySelector('.mg-winged-disc') as SVGGElement;
  const slots = Array.from(svg.querySelectorAll('.mg-slab')) as SVGGElement[];

  let acceptInput = false;
  let pressResolver: ((index: number) => void) | null = null;

  const onClick = (e: Event) => {
    const slot = (e.target as Element).closest('.mg-slab') as SVGGElement | null;
    if (!slot || !acceptInput) return;
    host.audio.stoneTap();
    slot.classList.add('is-lit');
    window.setTimeout(() => slot.classList.remove('is-lit'), 180);
    pressResolver?.(Number(slot.dataset.index));
  };
  svg.addEventListener('click', onClick);

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
    svg.classList.toggle('is-active', on);
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
    disc.classList.add('is-playing');
    host.setStatus('石板の光る順番を見ろ。');
    await sleep(650, signal);
    for (const id of seq) {
      slots[id].classList.add('is-lit');
      host.audio.stoneGlow();
      await sleep(params.on, signal);
      slots[id].classList.remove('is-lit');
      await sleep(params.off, signal);
    }
    disc.classList.remove('is-playing');
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
          scene.classList.add('is-shaking');
          window.setTimeout(() => scene.classList.remove('is-shaking'), 600);
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
          disc.classList.add('is-broken');
          scene.classList.add('is-open');
          host.setStatus('封印が砕けた。扉が開く。');
          host.setMeter(`${params.goalLen} / ${params.goalLen} 枚`);
          await sleep(1000, signal);
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
      svg.removeEventListener('click', onClick);
      wrap.remove();
    },
  };
};
