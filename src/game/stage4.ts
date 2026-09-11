/**
 * STAGE 4「呪われた谷」
 *
 * 実機と同じイライラ棒。折れ曲がった針金に輪を通し、
 * 針金に触れないよう端から端まで滑らせる。
 *
 * 判定は「輪の内側と針金のすき間」で決まる。輪は針金に通っているので、
 * 引っぱっても離れず、限界まで来たところで針金に当たってブザーが鳴る。
 * 通路の内側にとどまる作りではなく、実機どおり針金との接触を見ている。
 */

import type { StageFactory, StageHost, StageInstance } from './types';
import { clamp, el, fitCanvas, pointerPos } from './util';

const W = 320;
const H = 288;
/** 針金の太さ（半径） */
const WIRE_R = 2.6;
/** 輪の内側の半径。すき間 + 針金の太さで決まる */
const RING_LINE = 2.4;
/** 折れ線を細かく刻む間隔 (px)。輪の位置を針金上で追うのに使う */
const SAMPLE_STEP = 1.5;
/** 輪が針金の上を滑れる速さの上限 (px/s)。曲がり角を飛び越えさせないため */
const MAX_SLIDE = 1600;
/** 一度離した輪を握り直せる距離 */
const REGRAB_DIST = 26;

interface Params {
  /** 制限時間 (秒) */
  timeLimit: number;
  /** 輪の内側と針金のすき間 (px)。ここが難易度の中心 */
  clearance: number;
  /** 折れ曲がりの数 */
  bends: number;
  /** 接触してから次の接触を数えるまでの猶予 (ms) */
  penaltyFreeze: number;
}

const PARAMS: Record<string, Params> = {
  easy: { timeLimit: 50, clearance: 10, bends: 6, penaltyFreeze: 500 },
  normal: { timeLimit: 40, clearance: 7, bends: 8, penaltyFreeze: 400 },
  hard: { timeLimit: 32, clearance: 5, bends: 10, penaltyFreeze: 300 },
};

interface Point {
  x: number;
  y: number;
}

/**
 * 針金の形を作る。実機と同じく直線をつないだ角ばった形にする。
 * 左から右へ進みながら、上下に大きく振る。
 */
function buildWire(bends: number): Point[] {
  const pts: Point[] = [];
  const marginX = 26;
  const top = 38;
  const bottom = H - 34;
  const usableW = W - marginX * 2;
  const span = bottom - top;

  let x = marginX;
  let y = bottom;
  pts.push({ x, y });

  // 右へ進む区間の数。行って戻る枝を挟むので、進む量は一定にしない
  const legs = Math.max(3, Math.round(bends * 0.7));
  const stepX = usableW / legs;

  for (let i = 0; i < legs; i += 1) {
    const up = i % 2 === 0;

    // 1) 縦に大きく振る
    const rise = span * (0.4 + Math.random() * 0.32);
    y = clamp(up ? y - rise : y + rise, top, bottom);
    pts.push({ x, y });

    // 2) 横に進む
    x = clamp(x + stepX * (0.5 + Math.random() * 0.3), marginX, W - marginX);
    pts.push({ x, y });

    // 3) いったん戻って輪をつくる。
    //    実機の針金は単純なジグザグではなく、折り返しが連なっている。
    if (Math.random() < 0.65 && i < legs - 1) {
      const hookH = span * (0.15 + Math.random() * 0.13);
      const hookW = stepX * (0.28 + Math.random() * 0.24);
      const y2 = clamp(up ? y + hookH : y - hookH, top, bottom);
      pts.push({ x, y: y2 });
      const xBack = clamp(x - hookW, marginX, W - marginX);
      pts.push({ x: xBack, y: y2 });
      const y3 = clamp(up ? y2 + hookH * 0.7 : y2 - hookH * 0.7, top, bottom);
      pts.push({ x: xBack, y: y3 });
      const xFwd = clamp(x + hookW * 0.85, marginX, W - marginX);
      pts.push({ x: xFwd, y: y3 });
      x = xFwd;
      y = y3;
    }
  }

  // 右上のゴールへ寄せる
  pts.push({ x: W - marginX, y });
  pts.push({ x: W - marginX, y: top });
  return pts;
}

export const createStage4: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];
  const ringInner = params.clearance + WIRE_R;

  const wrap = el('div', 'mg-stage mg-stage4');
  const canvasWrap = el('div', 'mg-canvas-wrap mg-wire-wrap');
  const canvas = el('canvas', 'mg-canvas mg-canvas-wire');
  canvasWrap.append(canvas);

  const hint = el(
    'p',
    'mg-launch-hint',
    '緑の柱の輪を押さえ、針金に触れずに反対の柱まで滑らせろ',
  );
  wrap.append(canvasWrap, hint);
  root.appendChild(wrap);

  const ctx = fitCanvas(canvas, W, H);

  // --- 針金を折れ線として持ち、始点からの距離を引けるようにする ----------
  const corners = buildWire(params.bends);
  const pts: Point[] = [];
  const cum: number[] = [];
  {
    pts.push(corners[0]);
    cum.push(0);
    for (let i = 1; i < corners.length; i += 1) {
      const a = corners[i - 1];
      const b = corners[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / SAMPLE_STEP));
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        cum.push(cum[cum.length - 1] + len / steps);
      }
    }
  }
  const TOTAL = cum[cum.length - 1];
  const start = pts[0];
  const goal = pts[pts.length - 1];

  function posAt(s: number): Point {
    const target = clamp(s, 0, TOTAL);
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return pts[lo];
  }

  /**
   * 輪が針金の上をどこまで滑ったかを更新する。
   * 今いる位置の前後だけを探すので、離れた場所へ飛び移れない。
   * 実機で輪が針金に通っているのと同じ制約になる。
   */
  function slideToward(p: Point, s: number, maxStep: number): number {
    const from = clamp(s - maxStep, 0, TOTAL);
    const to = clamp(s + maxStep, 0, TOTAL);
    let bestS = s;
    let bestD = Infinity;
    for (let d = from; d <= to; d += SAMPLE_STEP) {
      const q = posAt(d);
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (dist < bestD) {
        bestD = dist;
        bestS = d;
      }
    }
    return bestS;
  }

  // --- 状態 -------------------------------------------------------------
  let ringS = 0;
  /** 輪の中心。針金の上の点から、すき間のぶんだけ離れられる */
  let ringPos: Point = { ...start };
  /** いま指（マウス）がある位置 */
  let pointer: Point = { ...start };
  let holding = false;
  let touching = false;
  let invuln = 0;
  let timeLeft = params.timeLimit;
  let running = true;
  let cleared = false;
  let rafId = 0;
  let lastT = 0;
  let shake = 0;
  let resolveRun: ((v: boolean) => void) | null = null;

  function updateMeter(): void {
    const pct = Math.round((ringS / TOTAL) * 100);
    host.setMeter(`残り ${timeLeft.toFixed(1)} 秒 ・ 到達 ${pct}%`);
  }

  function onPointerDown(e: PointerEvent): void {
    if (!running) return;
    host.audio.unlock();
    const p = pointerPos(canvas, e, W, H);
    // 輪のある場所を握る。離れた場所からは握れない
    if (Math.hypot(p.x - ringPos.x, p.y - ringPos.y) > REGRAB_DIST) return;
    holding = true;
    canvas.setPointerCapture(e.pointerId);
    host.setStatus('針金に触れずに滑らせろ。');
  }

  function onPointerMove(e: PointerEvent): void {
    if (!running || !holding) return;
    const p = pointerPos(canvas, e, W, H);
    pointer = p;
  }

  function onPointerUp(e: PointerEvent): void {
    holding = false;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function step(dt: number): void {
    if (invuln > 0) invuln -= dt * 1000;
    if (shake > 0) shake = Math.max(0, shake - dt * 4);

    if (!holding) {
      touching = false;
      return;
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateMeter();
      finish(false, '砂時計が尽きた');
      return;
    }

    // 針金の上を滑る。飛び越えはできない
    ringS = slideToward(pointer, ringS, MAX_SLIDE * dt);
    const onWire = posAt(ringS);

    // 輪の中心は針金からすき間のぶんだけしか離れられない
    const dx = pointer.x - onWire.x;
    const dy = pointer.y - onWire.y;
    const dist = Math.hypot(dx, dy);
    const wasTouching = touching;
    touching = dist >= params.clearance;

    if (touching) {
      const k = params.clearance / (dist || 1);
      ringPos = { x: onWire.x + dx * k, y: onWire.y + dy * k };

      // 実機のブザーは触れている間ずっと鳴る。
      // 触れた瞬間だけを数えると、輪を針金に擦りつけたまま引きずって
      // ライフ 1 つで大きく前進できてしまうので、触れている間は
      // 一定の間隔で数え続ける。
      if (invuln <= 0) {
        host.audio.zap();
        host.flash('bad');
        shake = 1;
        invuln = params.penaltyFreeze;
        const left = host.miss(
          wasTouching ? '輪が針金に触れ続けている' : '輪が針金に触れた',
        );
        if (left <= 0) {
          finish(false, '呪いに焼かれた');
          return;
        }
      }
    } else {
      ringPos = { x: pointer.x, y: pointer.y };
    }

    updateMeter();

    if (TOTAL - ringS < 4) {
      cleared = true;
      finish(true, '');
    }
  }

  function finish(ok: boolean, reason: string): void {
    if (!running) return;
    running = false;
    holding = false;
    if (ok) {
      host.setStatus('呪われた谷を渡り切った。');
      host.audio.correct();
      host.flash('good');
    } else if (reason) {
      host.setStatus(`${reason}。もう一度はじめの柱から挑め。`);
    }
    window.setTimeout(() => resolveRun?.(ok), ok ? 600 : 300);
  }

  // --- 描画 -------------------------------------------------------------
  function drawPost(p: Point, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function draw(): void {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * 3 * shake, (Math.random() * 2 - 1) * 3 * shake);
    }

    ctx.clearRect(-8, -8, W + 16, H + 16);

    // 台座。実機の斜面は目地の無い平らな砂岩なので、横線は引かない
    ctx.fillStyle = '#c08a3e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255, 226, 168, 0.25)';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = 'rgba(96, 58, 10, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    const tracePath = (): void => {
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    };

    // 針金。実機は黒い丸棒が素地から浮いていて、落ち影が出る
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(3, 4);
    ctx.strokeStyle = 'rgba(70, 40, 6, 0.38)';
    ctx.lineWidth = WIRE_R * 2 + 2;
    tracePath();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#0c0c0c';
    ctx.lineWidth = WIRE_R * 2 + 2;
    tracePath();
    ctx.stroke();

    // 棒の上側の光。丸みを出す
    ctx.save();
    ctx.translate(-0.8, -1.2);
    ctx.strokeStyle = 'rgba(160, 160, 168, 0.55)';
    ctx.lineWidth = Math.max(1.2, WIRE_R * 0.8);
    tracePath();
    ctx.stroke();
    ctx.restore();

    drawPost(start, '#5ec27a');
    drawPost(goal, '#ffcf8a');

    // 持ち手。輪から右下へ伸ばす
    const grip = { x: ringPos.x + 34, y: ringPos.y + 30 };
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ringPos.x, ringPos.y);
    ctx.lineTo(grip.x, grip.y);
    ctx.stroke();

    ctx.strokeStyle = touching ? '#f07d7d' : '#7d63c8';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(grip.x, grip.y);
    ctx.lineTo(grip.x + 22, grip.y + 19);
    ctx.stroke();

    // 輪。針金がこの中を通る
    ctx.strokeStyle = touching ? '#f07d7d' : '#e8e2d4';
    ctx.lineWidth = RING_LINE;
    ctx.beginPath();
    ctx.arc(ringPos.x, ringPos.y, ringInner, 0, Math.PI * 2);
    ctx.stroke();
    if (touching) {
      ctx.strokeStyle = 'rgba(240,125,125,0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ringPos.x, ringPos.y, ringInner + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!holding && !cleared) {
      ctx.fillStyle = 'rgba(244,241,232,0.9)';
      ctx.font = '12px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('輪を押さえて動かす', ringPos.x, ringPos.y - ringInner - 10);
    }

    ctx.restore();
  }

  function loop(t: number): void {
    if (!lastT) lastT = t;
    const dt = Math.min((t - lastT) / 1000, 0.032);
    lastT = t;
    step(dt);
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function run(): Promise<boolean> {
    host.setStatus('緑の柱にある輪を押さえろ。');
    updateMeter();
    return new Promise((resolve) => {
      resolveRun = resolve;
      rafId = requestAnimationFrame(loop);
    });
  }

  function dispose(): void {
    running = false;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    wrap.remove();
  }

  return { run, dispose };
};
