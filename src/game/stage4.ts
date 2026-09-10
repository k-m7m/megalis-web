/**
 * STAGE 4「呪われた谷」
 *
 * いわゆる「イライラ棒」。くねった通路にポインタを沿わせてゴールまで運ぶ。
 * 壁に触れるとブザーが鳴りライフが減る。制限時間内にゴールすればクリア。
 */

import type { StageFactory, StageHost, StageInstance } from './types';
import { clamp, el, fitCanvas, pointerPos } from './util';

const W = 320;
const H = 420;
const CURSOR_R = 7;

interface Params {
  timeLimit: number; // 秒
  pathHalf: number;
  segments: number;
  penaltyFreeze: number; // 壁接触時に無敵になる時間 (ms)
}

const PARAMS: Record<string, Params> = {
  easy: { timeLimit: 45, pathHalf: 20, segments: 7, penaltyFreeze: 500 },
  normal: { timeLimit: 35, pathHalf: 15, segments: 9, penaltyFreeze: 350 },
  hard: { timeLimit: 26, pathHalf: 11, segments: 11, penaltyFreeze: 250 },
};

interface Point {
  x: number;
  y: number;
}

/** 通路の中心線を蛇行するランダムウォークで生成する */
function buildPath(segments: number): Point[] {
  const pts: Point[] = [];
  const marginX = 40;
  const usableW = W - marginX * 2;
  let prevX = W / 2;
  pts.push({ x: prevX, y: H - 24 });
  for (let i = 1; i <= segments; i += 1) {
    const y = H - 24 - (i * (H - 48)) / segments;
    const dir = i % 2 === 0 ? 1 : -1;
    const swing = usableW * 0.32 * (0.5 + Math.random() * 0.5);
    let x = prevX + dir * swing;
    x = clamp(x, marginX, W - marginX);
    pts.push({ x, y });
    prevX = x;
  }
  pts.push({ x: pts[pts.length - 1].x, y: 20 });
  return pts;
}

function distToSegment(p: Point, a: Point, b: Point): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const projX = a.x + dx * t;
  const projY = a.y + dy * t;
  const dist = Math.hypot(p.x - projX, p.y - projY);
  return { dist, t };
}

export const createStage4: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];

  const wrap = el('div', 'mg-stage mg-stage4');
  const canvasWrap = el('div', 'mg-canvas-wrap');
  const canvas = el('canvas', 'mg-canvas mg-canvas-maze');
  canvasWrap.append(canvas);
  wrap.append(canvasWrap);
  root.appendChild(wrap);

  const ctx = fitCanvas(canvas, W, H);
  const path = buildPath(params.segments);
  const start = path[0];
  const goal = path[path.length - 1];

  let cursor: Point = { ...start };
  let progress = 0; // 0..1, ゴールまでの最遠到達度（見た目の目安）
  let timeLeft = params.timeLimit;
  let holding = false;
  let invuln = 0;
  let running = true;
  let rafId = 0;
  let lastT = 0;
  let resolveRun: ((v: boolean) => void) | null = null;
  let goalReached = false;

  function nearestOnPath(p: Point): number {
    let best = Infinity;
    for (let i = 0; i < path.length - 1; i += 1) {
      const { dist } = distToSegment(p, path[i], path[i + 1]);
      if (dist < best) best = dist;
    }
    return best;
  }

  function updateMeter(): void {
    host.setMeter(`残り時間 ${timeLeft.toFixed(1)} 秒`);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!running || !holding) return;
    const p = pointerPos(canvas, e, W, H);
    cursor = p;
  }

  function onPointerDown(e: PointerEvent): void {
    if (!running) return;
    host.audio.unlock();
    const p = pointerPos(canvas, e, W, H);
    if (Math.hypot(p.x - start.x, p.y - start.y) < 26) {
      holding = true;
      cursor = { ...start };
      host.setStatus('通路の壁に触れないよう、頂上のゴールまで運べ。');
    }
  }

  function onPointerUp(): void {
    holding = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  function step(dt: number): void {
    if (invuln > 0) invuln -= dt * 1000;

    if (holding) {
      timeLeft -= dt;
      updateMeter();
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateMeter();
        finish(false, 'タイムアップ');
        return;
      }

      const d = nearestOnPath(cursor);
      const clearance = params.pathHalf - CURSOR_R;
      if (d > clearance && invuln <= 0) {
        host.audio.zap();
        host.flash('bad');
        invuln = params.penaltyFreeze;
        const left = host.miss('通路の壁に触れた');
        if (left <= 0) {
          finish(false, '呪いに触れた');
          return;
        }
      }

      const distGoal = Math.hypot(cursor.x - goal.x, cursor.y - goal.y);
      progress = Math.max(progress, 1 - distGoal / H);
      if (distGoal < 20) {
        goalReached = true;
        finish(true, '');
      }
    } else {
      host.audio.tick();
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
      host.setStatus(`${reason}。もう一度通路の入り口から挑め。`);
    }
    window.setTimeout(() => resolveRun?.(ok), ok ? 500 : 250);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);

    // 通路
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(224,169,74,0.16)';
    ctx.lineWidth = params.pathHalf * 2;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224,169,74,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    // スタート/ゴール
    ctx.fillStyle = '#5ec27a';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0b04a';
    ctx.beginPath();
    ctx.moveTo(goal.x, goal.y - 14);
    ctx.lineTo(goal.x + 12, goal.y + 10);
    ctx.lineTo(goal.x - 12, goal.y + 10);
    ctx.closePath();
    ctx.fill();

    // カーソル（棒の先端）
    if (holding || !goalReached) {
      ctx.fillStyle = invuln > 0 ? '#f07d7d' : '#f4f1e8';
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, CURSOR_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!holding && !goalReached) {
      ctx.fillStyle = 'rgba(244,241,232,0.85)';
      ctx.font = '13px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('緑の丸から指を離さず谷を渡れ', W / 2, start.y - 26);
    }
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
    host.setStatus('スタート地点（緑の丸）を押さえたまま指を離さずに進め。');
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
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    wrap.remove();
  }

  return { run, dispose };
};
