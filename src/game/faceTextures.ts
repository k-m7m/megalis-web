/**
 * ピラミッドの各面に貼る絵を、その場で描き起こす。
 *
 * 実機は「4 つの面にそれぞれの遊びの仕掛けが載っている」形なので、
 * 抽象的な紋章ではなく、青いダイヤル・渦巻きの覆い・奥まった祭室・
 * 黒い針金といった実物の機構をそのまま描く。
 *
 * 面は三角形。上が頂点、下が底辺になる領域だけに絵を収める。
 * 三角形の外は貼られないが、縁で色が途切れないよう地色は全面に塗る。
 */

const SIZE = 512;

/** 実機の写真から採った色 */
const C = {
  body: '#ad6e40',
  bodyLit: '#d89868',
  bodyHi: '#e8b888',
  bodyDark: '#7a4418',
  seam: 'rgba(74, 32, 6, 0.55)',
  edgeLit: 'rgba(255, 216, 172, 0.32)',
  dialBlue: '#3048a8',
  dialBlueDark: '#22357e',
  knob: '#c08850',
  cover: '#3e3a52',
  coverLit: '#565074',
  groove: '#0c0c0c',
  panelNavy: '#1e2a5e',
  handle: '#6a4fb8',
  lampOff: '#8e9ab8',
  lampOn: '#ffe9c0',
};

export interface FaceArt {
  /** 面に貼る絵 */
  color: HTMLCanvasElement;
  /** 彫りの凹凸。明るいところが手前に出る */
  bump: HTMLCanvasElement;
  /** 選ばれたときに光る部分だけを抜いたもの */
  glow: HTMLCanvasElement;
}

type Ctx = CanvasRenderingContext2D;

function newCanvas(): { cv: HTMLCanvasElement; ctx: Ctx } {
  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2d context is unavailable');
  return { cv, ctx };
}

/** 面の三角形。上が頂点、下が底辺 */
function faceTriangle(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 0);
  ctx.lineTo(SIZE, SIZE);
  ctx.lineTo(0, SIZE);
  ctx.closePath();
}

/** その高さでの三角形の左右の端 */
function edgesAt(y: number): { left: number; right: number } {
  const half = (y / SIZE) * (SIZE / 2);
  return { left: SIZE / 2 - half, right: SIZE / 2 + half };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- 地肌 ---------------------------------------------------------------

/**
 * 成形されたプラスチックの段。
 * 実機は面いっぱいに横の段が入っていて、そこに光が乗る。
 */
function drawBody(ctx: Ctx): void {
  ctx.fillStyle = C.body;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(255, 216, 172, 0.26)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(70, 32, 6, 0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const courses = 22;
  for (let i = 1; i < courses; i += 1) {
    const y = (i / courses) * SIZE;
    // 段の下側に影、上側に光
    ctx.strokeStyle = C.seam;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
    ctx.strokeStyle = C.edgeLit;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y + 3.5);
    ctx.lineTo(SIZE, y + 3.5);
    ctx.stroke();
  }

  // 石の継ぎ目。段ごとにずらす
  for (let i = 1; i < courses; i += 1) {
    const y = (i / courses) * SIZE;
    const { left, right } = edgesAt(y);
    const blocks = 3 + Math.round(i * 0.7);
    for (let b = 1; b < blocks; b += 1) {
      const x = left + ((right - left) * b) / blocks + (i % 2 ? 10 : 0);
      ctx.strokeStyle = 'rgba(74, 32, 6, 0.34)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - SIZE / courses + 4);
      ctx.stroke();
    }
  }

  // ざらつき
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** 斜辺に沿って並ぶ人物の浮き彫り。実機の縁の意匠にあたる */
function drawEdgeFigures(ctx: Ctx, ink: string): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();
  ctx.fillStyle = ink;
  for (let i = 0; i < 5; i += 1) {
    const y = 220 + i * 58;
    const { left, right } = edgesAt(y);
    for (const [x, dir] of [[left + 26, 1], [right - 26, -1]] as [number, number][]) {
      // 頭・胴・脚だけの簡単な人形。小さく出るので輪郭を優先する
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, y + 8, 12, 20);
      ctx.fillRect(x - 6, y + 30, 5, 16);
      ctx.fillRect(x + 1, y + 30, 5, 16);
      // 前に伸ばした腕
      ctx.fillRect(dir > 0 ? x + 6 : x - 14, y + 11, 8, 4);
    }
  }
  ctx.restore();
}

// --- 4 面の仕掛け --------------------------------------------------------

/** 上部の操作パネル。実機のボタン列とロゴ板 */
function drawControlPanel(ctx: Ctx, cy: number, plate: string, ink: string): void {
  const w = 168;
  const x = SIZE / 2 - w / 2;
  ctx.fillStyle = plate;
  roundRect(ctx, x, cy - 16, w, 32, 5);
  ctx.fill();
  ctx.fillStyle = ink;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(x + 26 + i * 26, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(x + 128, cy - 7, 30, 14);
}

/** 面1 守護獣の叫び: 青い盤とタンのつまみ */
function faceDial(ctx: Ctx, ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const cy = 352;
  const r = 104;

  drawControlPanel(ctx, 214, lit ? '#000' : C.panelNavy, lit ? '#000' : C.bodyHi);

  // 盤の座
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 13, 0, Math.PI * 2);
  ctx.fill();

  // 青い盤
  ctx.fillStyle = lit ? '#000' : C.dialBlue;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 目盛りと守護獣の位置
  ctx.fillStyle = ink;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  // 中央のつまみ
  ctx.fillStyle = lit ? '#000' : C.knob;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? '#000' : 'rgba(74,32,6,0.6)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // 滑り止めの溝
  ctx.strokeStyle = lit ? '#000' : 'rgba(74,32,6,0.45)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
    ctx.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
    ctx.stroke();
  }

  // 上の指標
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 24);
  ctx.lineTo(cx + 13, cy - r - 4);
  ctx.lineTo(cx - 13, cy - r - 4);
  ctx.closePath();
  ctx.fill();
}

/** 面2 大蛇の回廊: 濃い青紫の覆いに渦巻きと 4 つの穴 */
function faceSpiral(ctx: Ctx, ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const cy = 348;
  const w = 268;
  const h = 232;

  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 26);
  ctx.fill();

  ctx.fillStyle = lit ? '#000' : C.cover;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 20);
  ctx.fill();

  // 渦巻きの溝
  ctx.strokeStyle = lit ? '#000' : C.coverLit;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  const turns = 3;
  const r0 = 96;
  ctx.beginPath();
  for (let i = 0; i <= 360 * turns; i += 4) {
    const th = (i * Math.PI) / 180 + Math.PI / 2;
    const rr = r0 - (r0 * 0.8 * i) / (360 * turns);
    const x = cx + Math.cos(th) * rr;
    const y = cy + Math.sin(th) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 4 つの穴
  ctx.fillStyle = ink;
  for (let i = 1; i <= 4; i += 1) {
    const deg = (360 * turns * i) / 5;
    const th = (deg * Math.PI) / 180 + Math.PI / 2;
    const rr = r0 - (r0 * 0.8 * deg) / (360 * turns);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // 中心の大蛇の口
  ctx.fillStyle = lit ? ink : C.groove;
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.fill();
}

/** 面3 封印の扉: 奥まった祭室に光る石板と立ち姿 */
function faceDoor(ctx: Ctx, ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const top = 238;
  const w = 252;
  const h = 226;
  const x = cx - w / 2;

  // 枠
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 12, top - 12, w + 24, h + 24, 8);
  ctx.fill();
  // まぐさ石
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  ctx.fillRect(x - 20, top - 34, w + 40, 24);

  // 奥の空間
  ctx.fillStyle = lit ? '#000' : '#241d2e';
  ctx.fillRect(x, top, w, h);

  // 石板。左寄りに 3x3
  const gw = w * 0.62;
  const cell = (gw - 16) / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillStyle = lit ? ink : C.lampOff;
      roundRect(
        ctx,
        x + 14 + col * (cell + 8),
        top + 18 + row * (cell + 8),
        cell,
        cell,
        3,
      );
      ctx.fill();
    }
  }

  // 右側に立つ守護者
  const fx = x + w * 0.82;
  const fy = top + 40;
  ctx.fillStyle = lit ? ink : C.knob;
  ctx.beginPath();
  ctx.arc(fx, fy + 16, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(fx - 16, fy + 34, 32, 62);
  ctx.fillRect(fx - 16, fy + 100, 13, 46);
  ctx.fillRect(fx + 3, fy + 100, 13, 46);
  // 冠の羽根
  ctx.fillRect(fx - 4, fy - 14, 8, 16);
}

/** 面4 呪われた谷: 黒い針金と紫の持ち手 */
function faceWire(ctx: Ctx, ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const cy = 352;
  const w = 280;
  const h = 210;

  // 針金を張る窪み
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 14);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : '#8d5828';
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 10);
  ctx.fill();

  // 針金
  const pts: [number, number][] = [
    [-0.95, 0.72], [-0.62, -0.66], [-0.3, 0.58], [0.0, -0.78],
    [0.3, 0.4], [0.62, -0.5], [0.95, 0.2],
  ];
  ctx.strokeStyle = lit ? '#000' : C.groove;
  ctx.lineWidth = 11;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const X = cx + px * (w / 2 - 18);
    const Y = cy + py * (h / 2 - 18);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();

  // 両端の柱
  ctx.fillStyle = ink;
  for (const [px, py] of [pts[0], pts[pts.length - 1]]) {
    ctx.beginPath();
    ctx.arc(cx + px * (w / 2 - 18), cy + py * (h / 2 - 18), 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // 輪と持ち手
  const hx = cx + 0.3 * (w / 2 - 18);
  const hy = cy + 0.4 * (h / 2 - 18);
  ctx.strokeStyle = lit ? ink : '#d8d2c4';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(hx, hy, 19, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = lit ? '#000' : C.handle;
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(hx + 16, hy + 14);
  ctx.lineTo(hx + 58, hy + 52);
  ctx.stroke();
}

const FACES = [faceDial, faceSpiral, faceDoor, faceWire];

/**
 * 面の中身を描く。
 * ink は彫り・線の色。lit を立てると発光用の描き方になる。
 */
function drawFaceContent(ctx: Ctx, index: number, ink: string, lit: boolean): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();
  FACES[index](ctx, ink, lit);
  ctx.restore();
}

/** 1 面ぶんの絵を作る */
export function buildFaceArt(index: number): FaceArt {
  // --- 色 ---
  const { cv: color, ctx: c } = newCanvas();
  drawBody(c);
  drawEdgeFigures(c, 'rgba(74, 32, 6, 0.42)');
  drawFaceContent(c, index, 'rgba(60, 26, 4, 0.85)', false);

  // --- 凹凸。黒いほど凹んで見える ---
  const { cv: bump, ctx: b } = newCanvas();
  b.fillStyle = '#909090';
  b.fillRect(0, 0, SIZE, SIZE);
  {
    const courses = 22;
    for (let i = 1; i < courses; i += 1) {
      const y = (i / courses) * SIZE;
      b.strokeStyle = '#2a2a2a';
      b.lineWidth = 4;
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(SIZE, y);
      b.stroke();
      b.strokeStyle = '#d8d8d8';
      b.lineWidth = 3;
      b.beginPath();
      b.moveTo(0, y + 4);
      b.lineTo(SIZE, y + 4);
      b.stroke();
    }
  }
  drawEdgeFigures(b, '#d0d0d0');
  drawFaceContent(b, index, '#202020', false);

  // --- 発光。仕掛けの要所だけ灯す ---
  const { cv: glow, ctx: g } = newCanvas();
  g.fillStyle = '#000000';
  g.fillRect(0, 0, SIZE, SIZE);
  drawFaceContent(g, index, '#ffcf9a', true);

  return { color, bump, glow };
}
