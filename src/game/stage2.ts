/**
 * STAGE 2「大蛇の回廊」
 *
 * 渦巻き状の回廊に玉を転がし込む。パワーゲージで決めた勢いだけ玉が奥へ進み、
 * 勢いを失ったところで最初に行き当たった穴に落ちる。光っている穴に落とせば成功。
 * 強すぎると 4 つの穴をすべて通り越し、最奥の大蛇の口に飲み込まれる。
 *
 * 発射に乱数は一切かけていない。同じパワーなら必ず同じ穴に入る。
 */

import type { StageFactory, StageHost, StageInstance } from './types';
import { clamp, el, fitCanvas, randIntAvoid } from './util';

const W = 320;
const H = 320;
const CX = W / 2;
const CY = H / 2;
const R_OUTER = 138;
const R_INNER = 30;
/** 渦巻きの巻き数 */
const TURNS = 3;
const BALL_R = 5.5;
const HOLE_R = 10.5;
const HOLE_COUNT = 4;
/** 玉の減速度 (px/s^2) */
const DECEL = 700;
/** 渦巻きを折れ線で近似するときの分割数 */
const SAMPLES = 1200;

interface Params {
  /** クリアに必要な的中数 */
  goalHits: number;
  /** ライフが 1 減るまでに許されるハズレ数 */
  maxMisses: number;
  /** ゲージが端から端まで動く秒数 */
  sweepTime: number;
  /** 狙う穴に対応するパワー帯をゲージ上に見せるか */
  guide: 'always' | 'hint' | 'none';
}

const PARAMS: Record<string, Params> = {
  easy: { goalHits: 2, maxMisses: 4, sweepTime: 1.4, guide: 'always' },
  normal: { goalHits: 3, maxMisses: 3, sweepTime: 1.0, guide: 'hint' },
  hard: { goalHits: 4, maxMisses: 3, sweepTime: 0.65, guide: 'none' },
};

/** ガイドを一時表示する難易度で、的が変わってから見せ続ける時間 (ms) */
const HINT_DURATION = 2500;

interface Point {
  x: number;
  y: number;
}

export const createStage2: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];

  // --- 画面の組み立て ---------------------------------------------------
  const wrap = el('div', 'mg-stage mg-stage2');
  const canvasWrap = el('div', 'mg-canvas-wrap');
  const canvas = el('canvas', 'mg-canvas');
  canvasWrap.append(canvas);

  const gauge = el('div', 'mg-gauge');
  gauge.innerHTML = `
    <div class="mg-gauge-track">
      <div class="mg-gauge-band" hidden></div>
      <div class="mg-gauge-needle"></div>
    </div>
    <div class="mg-gauge-scale"><span>弱</span><span>強</span></div>
    <p class="mg-launch-hint">タップ（クリック / スペースキー）で発射</p>
  `;

  wrap.append(canvasWrap, gauge);
  root.appendChild(wrap);

  const ctx = fitCanvas(canvas, W, H);
  const bandEl = gauge.querySelector('.mg-gauge-band') as HTMLElement;
  const needleEl = gauge.querySelector('.mg-gauge-needle') as HTMLElement;
  const hintEl = gauge.querySelector('.mg-launch-hint') as HTMLElement;

  // --- 渦巻きの形を作る -------------------------------------------------
  // 折れ線で近似し、始点からの累積距離を持っておく。
  // これで「入口から s px の地点」を正確に引ける。
  const pts: Point[] = [];
  const cum: number[] = [];
  {
    const thetaMax = TURNS * Math.PI * 2;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const u = i / SAMPLES;
      const th = u * thetaMax + Math.PI / 2; // 入口を真下にする
      const r = R_OUTER - (R_OUTER - R_INNER) * u;
      pts.push({ x: CX + r * Math.cos(th), y: CY + r * Math.sin(th) });
    }
    cum.push(0);
    for (let i = 1; i <= SAMPLES; i += 1) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
  }
  const TOTAL = cum[SAMPLES];
  /** 穴の間隔。入口〜穴1、穴1〜穴2 … 穴4〜最奥がすべてこの長さになる */
  const GAP = TOTAL / (HOLE_COUNT + 1);
  const holeS: number[] = Array.from({ length: HOLE_COUNT }, (_, i) => (i + 1) * GAP);
  /**
   * 玉が「落ちるほど遅くなる」速さ。
   * GAP と釣り合わせておくと、パワー最小でも必ず穴1には届く。
   */
  const CAPTURE_SPEED = Math.sqrt(2 * DECEL * GAP);

  function posAt(s: number): Point {
    const target = clamp(s, 0, TOTAL);
    let lo = 0;
    let hi = SAMPLES;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return pts[0];
    const segLen = cum[lo] - cum[lo - 1];
    const k = segLen > 0 ? (target - cum[lo - 1]) / segLen : 0;
    const a = pts[lo - 1];
    const b = pts[lo];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  const holePos: Point[] = holeS.map((s) => posAt(s));
  const mouthPos: Point = posAt(TOTAL);

  // --- 状態 -------------------------------------------------------------
  type Phase = 'aiming' | 'rolling' | 'pause';

  let phase: Phase = 'aiming';
  let gaugeT = 0;
  let gaugeDir = 1;
  let target = Math.floor(Math.random() * HOLE_COUNT);
  let targetLitAt = performance.now();

  let ballS = 0;
  let ballV = 0;
  let ballAlive = false;
  let pendingHole: number | null = null;
  let dropAnim = 0; // 穴に吸い込まれる演出の残り (1 → 0)
  let dropAt: Point | null = null;
  let lastTurnTick = 0;

  let hits = 0;
  let misses = 0;
  let running = true;
  let rafId = 0;
  let lastT = 0;
  let resolveRun: ((v: boolean) => void) | null = null;

  function updateMeter(): void {
    host.setMeter(
      `${hits} / ${params.goalHits} 的中 ・ ハズレ ${misses} / ${params.maxMisses}`,
    );
  }

  /** 穴 j に落とすためのパワー帯。ゲージ全体を「穴の数 + 大蛇の口」で割ったもの */
  function bandFor(j: number): { from: number; to: number } {
    return { from: j / (HOLE_COUNT + 1), to: (j + 1) / (HOLE_COUNT + 1) };
  }

  function guideVisible(): boolean {
    if (params.guide === 'always') return true;
    if (params.guide === 'none') return false;
    return performance.now() - targetLitAt < HINT_DURATION;
  }

  function newTarget(): void {
    target = randIntAvoid(HOLE_COUNT, target);
    targetLitAt = performance.now();
  }

  function launch(t: number): void {
    host.audio.launch();

    // 玉は速度が CAPTURE_SPEED を下回ると穴に落ちる。
    // v(s)^2 = v0^2 - 2*DECEL*s なので、v0 を下の式で決めると
    // 「s が p を超えた瞬間から落ちるようになる」と一対一で対応する。
    // つまり落ちる穴は p だけで決まり、発射した時点で確定している。
    //
    // フレームごとに速度を見て判定すると、判定の粒度がフレーム時間に依存して
    // 遅い端末で結果が変わってしまう。だからここで解析的に決めておく。
    const p = t * TOTAL;
    pendingHole = holeS.findIndex((s) => s > p);
    if (pendingHole < 0) pendingHole = null; // どの穴も越える = 大蛇の口

    ballV = Math.sqrt(CAPTURE_SPEED * CAPTURE_SPEED + 2 * DECEL * p);
    ballS = 0;
    ballAlive = true;
    lastTurnTick = 0;
    phase = 'rolling';
    host.setStatus('玉が回廊を転がっていく。');
  }

  function settle(holeIndex: number | null): void {
    ballAlive = false;
    dropAnim = 1;

    if (holeIndex === null) {
      dropAt = mouthPos;
      host.audio.wrong();
      host.flash('bad');
      misses += 1;
      host.setStatus('勢いが強すぎた。最奥の大蛇に飲み込まれた。');
    } else {
      dropAt = holePos[holeIndex];
      if (holeIndex === target) {
        hits += 1;
        host.audio.pocket();
        host.flash('good');
        host.setStatus('光る穴に落ちた。');
      } else {
        misses += 1;
        host.audio.wrong();
        host.flash('bad');
        host.setStatus(`${holeIndex + 1}番の穴に落ちた。狙いは別の穴だ。`);
      }
    }

    updateMeter();
    phase = 'pause';
    window.setTimeout(afterSettle, 900);
  }

  function afterSettle(): void {
    if (!running) return;

    if (hits >= params.goalHits) {
      running = false;
      host.setStatus('大蛇の回廊を抜けた。');
      window.setTimeout(() => resolveRun?.(true), 500);
      return;
    }

    if (misses >= params.maxMisses) {
      misses = 0;
      updateMeter();
      const left = host.miss('狙った穴に玉を入れられなかった');
      if (left <= 0) {
        running = false;
        window.setTimeout(() => resolveRun?.(false), 300);
        return;
      }
    }

    newTarget();
    phase = 'aiming';
    host.setStatus('光る穴に落ちるパワーで発射しろ。');
  }

  function onPress(): void {
    if (!running) return;
    host.audio.unlock();
    if (phase !== 'aiming') return;
    launch(gaugeT);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    onPress();
  }

  wrap.addEventListener('pointerdown', onPress);
  window.addEventListener('keydown', onKeyDown);

  // --- 毎フレームの更新 -------------------------------------------------
  function step(dt: number): void {
    if (phase === 'aiming') {
      gaugeT += (gaugeDir * dt) / params.sweepTime;
      if (gaugeT >= 1) {
        gaugeT = 1;
        gaugeDir = -1;
      } else if (gaugeT <= 0) {
        gaugeT = 0;
        gaugeDir = 1;
      }
    }

    if (dropAnim > 0) dropAnim = Math.max(0, dropAnim - dt * 4);

    if (!ballAlive) return;

    // 等加速度なので、フレーム内の平均速度で進めれば誤差なく積分できる。
    // 単純に「減速してから進む」と少しずつ距離が足りなくなり、
    // 玉が穴の手前で止まって見える。
    const vNext = Math.max(0, ballV - DECEL * dt);
    ballS += ((ballV + vNext) / 2) * dt;
    ballV = vNext;

    // 一周ごとに転がる音を鳴らす
    const turn = Math.floor(ballS / (TOTAL / TURNS));
    if (turn > lastTurnTick) {
      lastTurnTick = turn;
      host.audio.peg();
    }

    // 落ちる先は発射時に確定済み。そこへ到達したかだけを見る
    const goalS = pendingHole === null ? TOTAL : holeS[pendingHole];
    if (ballS >= goalS || ballV <= 0) {
      ballS = goalS;
      settle(pendingHole);
    }
  }

  function renderGauge(): void {
    needleEl.style.left = `${gaugeT * 100}%`;
    const show = phase === 'aiming' && guideVisible();
    bandEl.hidden = !show;
    if (show) {
      const { from, to } = bandFor(target);
      bandEl.style.left = `${from * 100}%`;
      bandEl.style.width = `${(to - from) * 100}%`;
    }
  }

  // --- 描画 -------------------------------------------------------------
  function strokeSpiral(color: string, width: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= SAMPLES; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function drawSnakeMouth(): void {
    const outer = R_INNER * 0.72;
    ctx.fillStyle = '#0b0908';
    ctx.beginPath();
    ctx.arc(mouthPos.x, mouthPos.y, outer, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c9bda6';
    const fangs = 8;
    for (let i = 0; i < fangs; i += 1) {
      const a = (i / fangs) * Math.PI * 2;
      const inner = outer - 6;
      ctx.beginPath();
      ctx.moveTo(mouthPos.x + Math.cos(a - 0.16) * outer, mouthPos.y + Math.sin(a - 0.16) * outer);
      ctx.lineTo(mouthPos.x + Math.cos(a) * inner, mouthPos.y + Math.sin(a) * inner);
      ctx.lineTo(mouthPos.x + Math.cos(a + 0.16) * outer, mouthPos.y + Math.sin(a + 0.16) * outer);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHoles(): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < HOLE_COUNT; j += 1) {
      const p = holePos[j];
      const lit = j === target && phase !== 'pause';

      ctx.beginPath();
      ctx.arc(p.x, p.y, HOLE_R, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#ffe08a' : '#a02820';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = lit ? '#fff2c8' : '#5a1410';
      ctx.stroke();

      if (lit) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, HOLE_R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 224, 138, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = lit ? '#3a2000' : 'rgba(255, 210, 200, 0.85)';
      ctx.font = 'bold 10px "Noto Sans JP", sans-serif';
      ctx.fillText(String(j + 1), p.x, p.y + 0.5);
    }
  }

  function drawEntrance(): void {
    const p = pts[0];
    ctx.strokeStyle = '#e0b86a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y + 12);
    ctx.lineTo(p.x - 9, p.y - 4);
    ctx.moveTo(p.x + 9, p.y + 12);
    ctx.lineTo(p.x + 9, p.y - 4);
    ctx.stroke();
  }

  /** 実機と同じ、渦巻きが彫られた青い円盤 */
  function drawDisc(): void {
    // 盤の座
    ctx.fillStyle = '#8a5e1c';
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUTER + 20, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(CX - 40, CY - 50, 20, CX, CY, R_OUTER + 14);
    g.addColorStop(0, '#3a4ea8');
    g.addColorStop(1, '#1d2a70');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUTER + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 140, 220, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUTER + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawDisc();
    // 彫り込まれた溝。暗い青の谷に明るい縁が立つ
    strokeSpiral('#16215c', 22);
    strokeSpiral('rgba(130, 150, 230, 0.45)', 2.5);
    drawSnakeMouth();
    drawHoles();
    drawEntrance();

    if (ballAlive) {
      const p = posAt(ballS);
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    } else if (dropAnim > 0 && dropAt) {
      ctx.fillStyle = `rgba(244, 241, 232, ${dropAnim})`;
      ctx.beginPath();
      ctx.arc(dropAt.x, dropAt.y, BALL_R * dropAnim, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(t: number): void {
    if (!lastT) lastT = t;
    const dt = Math.min((t - lastT) / 1000, 0.032);
    lastT = t;
    step(dt);
    renderGauge();
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function run(): Promise<boolean> {
    host.setStatus('光る穴に落ちるパワーで発射しろ。');
    if (params.guide === 'none') {
      hintEl.textContent = 'タップで発射 ・ 目安の表示はない';
    }
    updateMeter();
    return new Promise((resolve) => {
      resolveRun = resolve;
      rafId = requestAnimationFrame(loop);
    });
  }

  function dispose(): void {
    running = false;
    cancelAnimationFrame(rafId);
    wrap.removeEventListener('pointerdown', onPress);
    window.removeEventListener('keydown', onKeyDown);
    wrap.remove();
  }

  return { run, dispose };
};
