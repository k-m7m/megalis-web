/**
 * ピラミッドの各面に貼る絵を、その場で描き起こす。
 *
 * 画像ファイルは持たないので、砂岩の地肌も彫り込みもすべて canvas で作る。
 * 面は三角形なので、上が頂点・下が底辺になる領域だけに絵を収める。
 * 三角形の外側は貼られないが、縁で色が途切れないよう地の色は全面に塗る。
 */

const SIZE = 512;

export interface FaceArt {
  /** 面に貼る絵 */
  color: HTMLCanvasElement;
  /** 彫りの凹凸。明るいところが手前に出る */
  bump: HTMLCanvasElement;
  /** 選ばれたときに光る部分だけを白で抜いたもの */
  glow: HTMLCanvasElement;
}

function newCanvas(): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2d context is unavailable');
  return { cv, ctx };
}

/** 面の三角形。上が頂点、下が底辺 */
function faceTriangle(ctx: CanvasRenderingContext2D): void {
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

/** 砂岩の地肌。石を積んだ段と、ざらつきを描く */
function drawStone(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#8a6f45';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 上ほど明るく、下ほど陰る
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(255, 226, 170, 0.35)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 石積みの段
  const courses = 16;
  for (let i = 1; i < courses; i += 1) {
    const y = (i / courses) * SIZE;
    ctx.strokeStyle = 'rgba(60, 44, 24, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 232, 186, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    ctx.lineTo(SIZE, y + 3);
    ctx.stroke();

    // 縦の目地。段ごとにずらす
    const blocks = 4 + i;
    const { left, right } = edgesAt(y);
    for (let b = 1; b < blocks; b += 1) {
      const x = left + ((right - left) * b) / blocks + (i % 2 ? 8 : 0);
      ctx.strokeStyle = 'rgba(60, 44, 24, 0.38)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - SIZE / courses);
      ctx.stroke();
    }
  }

  // ざらつき
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** 面の縁を彫り込んだ枠で締める */
function drawBorder(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 26);
  ctx.lineTo(SIZE - 22, SIZE - 18);
  ctx.lineTo(22, SIZE - 18);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** 枠に沿ってヒエログリフ風の刻みを並べる */
function drawGlyphBand(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();
  ctx.fillStyle = color;
  const y = SIZE - 52;
  const { left, right } = edgesAt(y);
  const n = 9;
  for (let i = 0; i < n; i += 1) {
    const x = left + 30 + ((right - left - 60) * i) / (n - 1);
    const h = 12 + (i % 3) * 6;
    ctx.fillRect(x - 5, y - h / 2, 10, h);
    if (i % 2 === 0) ctx.fillRect(x - 9, y + h / 2 + 4, 18, 4);
  }
  ctx.restore();
}

// --- 4 面それぞれの中心の意匠 -------------------------------------------

/** STAGE 1 守護獣の叫び: ダイヤルと 6 つの目盛り */
function emblemDial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r * 0.72;
    const y = cy + Math.sin(a) * r * 0.72;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  // 上の指標
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 22);
  ctx.lineTo(cx + 13, cy - r - 2);
  ctx.lineTo(cx - 13, cy - r - 2);
  ctx.closePath();
  ctx.fill();
}

/** STAGE 2 大蛇の回廊: 渦巻きと 4 つの穴 */
function emblemSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.lineWidth = 9;
  ctx.beginPath();
  const turns = 3;
  for (let i = 0; i <= 360 * turns; i += 4) {
    const th = (i * Math.PI) / 180;
    const rr = r - (r * 0.78 * i) / (360 * turns);
    const x = cx + Math.cos(th + Math.PI / 2) * rr;
    const y = cy + Math.sin(th + Math.PI / 2) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 1; i <= 4; i += 1) {
    const th = ((360 * turns * i) / 5) * (Math.PI / 180);
    const rr = r - (r * 0.78 * ((360 * turns * i) / 5)) / (360 * turns);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(th + Math.PI / 2) * rr, cy + Math.sin(th + Math.PI / 2) * rr, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** STAGE 3 封印の扉: まぐさ石のある扉と 9 枚の石板 */
function emblemDoor(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const w = r * 1.35;
  const h = r * 1.75;
  ctx.lineWidth = 9;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // まぐさ石
  ctx.fillRect(cx - w / 2 - 14, cy - h / 2 - 22, w + 28, 20);
  // 石板
  const cell = (w - 34) / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillRect(
        cx - w / 2 + 12 + col * (cell + 5),
        cy - h / 2 + 22 + row * (cell + 5),
        cell,
        cell,
      );
    }
  }
}

/** STAGE 4 呪われた谷: 折れ曲がった針金と輪 */
function emblemWire(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.lineWidth = 8;
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  const pts = [
    [-1, 0.7], [-0.62, -0.55], [-0.24, 0.5], [0.1, -0.7], [0.5, 0.35], [1, -0.6],
  ];
  pts.forEach(([px, py], i) => {
    const x = cx + px * r;
    const y = cy + py * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // 輪
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx + 0.1 * r, cy - 0.7 * r * 0.8, 26, 0, Math.PI * 2);
  ctx.stroke();
}

const EMBLEMS = [emblemDial, emblemSpiral, emblemDoor, emblemWire];

/** 面の中の絵をまとめて描く。色を変えて色・凹凸・発光の 3 枚に使い回す */
function drawFaceContent(
  ctx: CanvasRenderingContext2D,
  index: number,
  ink: string,
  numberInk: string,
): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();

  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  EMBLEMS[index](ctx, SIZE / 2, SIZE * 0.62, 92);

  // 面の番号。頂点寄りに置く
  ctx.fillStyle = numberInk;
  ctx.font = 'bold 60px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), SIZE / 2, SIZE * 0.26);

  ctx.restore();
}

/** 1 面ぶんの絵を作る */
export function buildFaceArt(index: number): FaceArt {
  // 色
  const { cv: color, ctx: c } = newCanvas();
  drawStone(c);
  drawBorder(c, 'rgba(58, 42, 22, 0.75)', 10);
  drawGlyphBand(c, 'rgba(58, 42, 22, 0.55)');
  drawFaceContent(c, index, 'rgba(52, 37, 19, 0.85)', 'rgba(52, 37, 19, 0.9)');

  // 凹凸。黒いところが凹んで見える
  const { cv: bump, ctx: b } = newCanvas();
  b.fillStyle = '#808080';
  b.fillRect(0, 0, SIZE, SIZE);
  {
    // 石積みの段を凹ませる
    const courses = 16;
    for (let i = 1; i < courses; i += 1) {
      const y = (i / courses) * SIZE;
      b.strokeStyle = '#2b2b2b';
      b.lineWidth = 4;
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(SIZE, y);
      b.stroke();
    }
  }
  drawBorder(b, '#1e1e1e', 12);
  drawGlyphBand(b, '#242424');
  drawFaceContent(b, index, '#1a1a1a', '#1a1a1a');

  // 発光。選ばれたときに光る部分だけ白く抜く
  const { cv: glow, ctx: g } = newCanvas();
  g.fillStyle = '#000000';
  g.fillRect(0, 0, SIZE, SIZE);
  drawGlyphBand(g, '#4a3a1e');
  drawFaceContent(g, index, '#f0c878', '#ffe6b0');

  return { color, bump, glow };
}
