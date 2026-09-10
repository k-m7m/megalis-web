/**
 * STAGE 2「大蛇の回廊」
 *
 * 回廊に打ち出した玉が釘に当たって落ちていく、パチンコ（ピンボール）風の
 * ステージ。玉が落ちる先の「当たりポケット」を規定数当てればクリア。
 * ハズレのポケットに落ちるとライフが 1 減る。
 */

import type { StageFactory, StageHost, StageInstance } from './types';
import { clamp, el, fitCanvas, randInt } from './util';

const W = 320;
const H = 420;
const BALL_R = 5;
const GRAVITY = 780; // px/s^2
const RESTITUTION = 0.62;

interface Peg {
  x: number;
  y: number;
  r: number;
}

interface Pocket {
  x0: number;
  x1: number;
  hit: boolean;
  y: number;
}

interface Params {
  goalHits: number;
  pegRows: number;
  hitPocketRatio: number;
  ballSpeedJitter: number;
}

const PARAMS: Record<string, Params> = {
  easy: { goalHits: 3, pegRows: 6, hitPocketRatio: 0.55, ballSpeedJitter: 40 },
  normal: { goalHits: 4, pegRows: 7, hitPocketRatio: 0.42, ballSpeedJitter: 60 },
  hard: { goalHits: 5, pegRows: 8, hitPocketRatio: 0.3, ballSpeedJitter: 90 },
};

export const createStage2: StageFactory = (
  root: HTMLElement,
  host: StageHost,
): StageInstance => {
  const params = PARAMS[host.difficulty];

  const wrap = el('div', 'mg-stage mg-stage2');
  const canvasWrap = el('div', 'mg-canvas-wrap');
  const canvas = el('canvas', 'mg-canvas');
  const launcher = el('div', 'mg-launcher');
  const power = el('div', 'mg-power-bar', '<div class="mg-power-fill"></div>');
  const hint = el('div', 'mg-launch-hint', 'クリック（タップ）で玉を打ち出す');

  canvasWrap.append(canvas);
  launcher.append(power, hint);
  wrap.append(canvasWrap, launcher);
  root.appendChild(wrap);

  const ctx = fitCanvas(canvas, W, H);
  const powerFill = power.querySelector('.mg-power-fill') as HTMLElement;

  // --- 盤面構築 ---------------------------------------------------------
  const pegs: Peg[] = [];
  const rowGap = 34;
  const topMargin = 60;
  for (let row = 0; row < params.pegRows; row += 1) {
    const y = topMargin + row * rowGap;
    const cols = 5 + (row % 2);
    const spacing = W / (cols + 1);
    for (let c = 1; c <= cols; c += 1) {
      const jitterX = (row % 2 === 0 ? 0 : spacing / 2);
      pegs.push({ x: c * spacing - spacing / 2 + jitterX, y, r: 4.5 });
    }
  }

  const pocketCount = 8;
  const pocketW = W / pocketCount;
  const pocketY = H - 24;
  const hitIndexes = new Set<number>();
  {
    const wantHits = Math.max(2, Math.round(pocketCount * params.hitPocketRatio));
    while (hitIndexes.size < wantHits) hitIndexes.add(randInt(pocketCount));
  }
  const pockets: Pocket[] = Array.from({ length: pocketCount }, (_, i) => ({
    x0: i * pocketW,
    x1: (i + 1) * pocketW,
    hit: hitIndexes.has(i),
    y: pocketY,
  }));

  interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
  }

  let balls: Ball[] = [];
  let hits = 0;
  let misses = 0;
  const maxMisses = 4; // これを超えたらこのステージではミス扱い（ライフを消費）
  let running = true;
  let rafId = 0;
  let lastT = 0;

  let charging = false;
  let chargeStart = 0;

  let resolveRun: ((v: boolean) => void) | null = null;

  function updateMeter(): void {
    host.setMeter(`${hits} / ${params.goalHits} 的中`);
  }

  function launchBall(strength: number): void {
    host.audio.launch();
    const speed = 260 + strength * 260 + (Math.random() * 2 - 1) * params.ballSpeedJitter;
    balls.push({
      x: W / 2 + (Math.random() * 2 - 1) * 8,
      y: H - 40,
      vx: (Math.random() * 2 - 1) * 40,
      vy: -speed,
      alive: true,
    });
  }

  function onPointerDown(): void {
    if (!running) return;
    host.audio.unlock();
    charging = true;
    chargeStart = performance.now();
  }

  function onPointerUp(): void {
    if (!running || !charging) return;
    charging = false;
    const held = clamp((performance.now() - chargeStart) / 900, 0.15, 1);
    launchBall(held);
    powerFill.style.width = '0%';
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  function step(dt: number): void {
    if (charging) {
      const t = clamp((performance.now() - chargeStart) / 900, 0, 1);
      powerFill.style.width = `${Math.round(t * 100)}%`;
    }

    for (const b of balls) {
      if (!b.alive) continue;
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx *= -RESTITUTION;
        host.audio.wall();
      } else if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        b.vx *= -RESTITUTION;
        host.audio.wall();
      }

      for (const peg of pegs) {
        const dx = b.x - peg.x;
        const dy = b.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = BALL_R + peg.r;
        if (dist < minDist && dist > 0.0001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const vn = b.vx * nx + b.vy * ny;
          b.vx -= 2 * vn * nx * RESTITUTION;
          b.vy -= 2 * vn * ny * RESTITUTION;
          b.vx += (Math.random() * 2 - 1) * 18;
          host.audio.peg();
        }
      }

      if (b.y >= pocketY - BALL_R) {
        b.alive = false;
        const idx = clamp(Math.floor(b.x / pocketW), 0, pocketCount - 1);
        const pocket = pockets[idx];
        if (pocket.hit) {
          hits += 1;
          host.audio.pocket();
          host.flash('good');
        } else {
          misses += 1;
          host.audio.wrong();
          host.flash('bad');
        }
        updateMeter();
        checkOutcome();
      }
    }
    balls = balls.filter((b) => b.alive);
  }

  function checkOutcome(): void {
    if (!running) return;
    if (hits >= params.goalHits) {
      running = false;
      host.setStatus('大蛇の回廊を抜けた。');
      window.setTimeout(() => resolveRun?.(true), 500);
      return;
    }
    if (misses >= maxMisses) {
      const left = host.miss('ハズレのポケットに玉が落ちた');
      misses = 0;
      if (left <= 0) {
        running = false;
        window.setTimeout(() => resolveRun?.(false), 300);
      } else {
        host.setStatus('毒だまりに落ちた。狙いを定め直せ。');
      }
    }
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);

    // 背景の縦縞（回廊っぽさ）
    ctx.fillStyle = 'rgba(224,169,74,0.04)';
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect((i * W) / 6, 0, 2, H);
    }

    // ポケット
    for (const p of pockets) {
      ctx.fillStyle = p.hit ? 'rgba(94, 194, 122, 0.28)' : 'rgba(240, 125, 125, 0.14)';
      ctx.fillRect(p.x0 + 2, pocketY, pocketW - 4, H - pocketY);
      ctx.strokeStyle = p.hit ? '#5ec27a' : 'rgba(240,125,125,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x0 + 2, pocketY, pocketW - 4, H - pocketY - 1);
    }

    // 釘
    ctx.fillStyle = '#e0a94a';
    for (const peg of pegs) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玉
    ctx.fillStyle = '#f4f1e8';
    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(t: number): void {
    if (!lastT) lastT = t;
    const dt = Math.min((t - lastT) / 1000, 0.032);
    lastT = t;
    step(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function run(): Promise<boolean> {
    host.setStatus('パワーを溜めて玉を打ち出し、光るポケットを狙え。');
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
    window.removeEventListener('pointerup', onPointerUp);
    wrap.remove();
  }

  return { run, dispose };
};
