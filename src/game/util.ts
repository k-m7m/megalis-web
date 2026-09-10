/** DOM とタイミングまわりの小さな道具 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** ステージ破棄時に進行中の await を打ち切るための例外 */
export class AbortError extends Error {
  constructor() {
    super('stage aborted');
    this.name = 'AbortError';
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof AbortError || (e as Error)?.name === 'AbortError';
}

export function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/** 直前と同じ値が続かない乱数。記憶ゲームの出題に使う */
export function randIntAvoid(n: number, avoid: number): number {
  if (n <= 1) return 0;
  let v = randInt(n);
  while (v === avoid) v = randInt(n);
  return v;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 見た目のサイズに合わせて canvas の解像度を合わせる */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(logicalW * dpr);
  canvas.height = Math.round(logicalH * dpr);
  canvas.style.aspectRatio = `${logicalW} / ${logicalH}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context is unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** canvas 上のポインタ座標を論理座標に直す */
export function pointerPos(
  canvas: HTMLCanvasElement,
  e: PointerEvent,
  logicalW: number,
  logicalH: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * logicalW,
    y: ((e.clientY - rect.top) / rect.height) * logicalH,
  };
}
