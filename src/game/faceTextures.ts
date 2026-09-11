/**
 * ピラミッドの各面に貼る絵を、その場で描き起こす。
 *
 * 実機は 4 つの面それぞれに遊びの仕掛けが載っている。
 * 写真から読み取った構成をそのまま写す。
 *
 *   面1 守護獣の叫び … 大きな青い円盤とタンのつまみ。上にロゴ板とボタン列
 *   面2 大蛇の回廊   … 青い円盤に彫られた渦巻きと、赤く見える穴
 *   面3 封印の扉     … 奥まった祭室の中央に金色のファラオ像、まわりに光る板
 *   面4 呪われた谷   … 輪が連なる黒い針金の迷路と、紫の持ち手
 *
 * 面は三角形。上が頂点、下が底辺になる領域だけに絵を収める。
 * 三角形の外は貼られないが、縁で色が途切れないよう地色は全面に塗る。
 */

const SIZE = 512;

/** 実機の写真から採った色 */
const C = {
  /** 本体。金寄りのタン */
  body: '#d0913f',
  bodyLit: '#e0b86a',
  bodyHi: '#f0d49a',
  bodyDark: '#8a5e1c',
  seam: 'rgba(96, 58, 10, 0.5)',
  edgeLit: 'rgba(255, 226, 168, 0.34)',
  /** 円盤の青。実機は明るめのロイヤルブルー */
  blue: '#243cc3',
  /** 円盤の浮き彫り。同じ青の明暗で表す */
  blueRaised: '#2b47c8',
  blueSunk: '#101f8c',
  /** 銘板の銀 */
  silver: '#c8ccd4',
  blueLit: '#4a5ce0',
  blueDark: '#1a2a86',
  /** つまみ。実機はサーモン寄りのタン */
  knobTop: '#d99b78',
  knobSide: '#b87a52',
  knob: '#d99b78',
  knobLit: '#e8b898',
  /** 針金・溝 */
  groove: '#0c0c0c',
  /** 穴の赤 */
  holeRed: '#a02820',
  /** 紫の持ち手 */
  handle: '#2b3caf',
  /** 光る板 */
  lampOff: '#7d8996',
  /** 操作ボタン。実機は濃紺 */
  button: '#3434c8',
  /** 銘板の濃い青 */
  plateBlue: '#1d2bb4',
  /** 液晶のアンバー。実機は暗めの琥珀 */
  lcd: '#9d7a2a',
  /** 祭室の奥。枠より一段暗く落として奥行きを出す */
  chamber: '#4e5a6c',
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
 * 地肌。
 *
 * 実機の斜面は無地に近い。装飾は外周を一周する額縁の帯と、
 * 左下の階段状のブロックだけ。
 * 横の目地を並べると「レンガのピラミッド」に見えてしまうので入れない。
 */
function drawBody(ctx: Ctx): void {
  ctx.fillStyle = C.body;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(255, 236, 196, 0.16)');
  grad.addColorStop(0.62, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(96, 58, 10, 0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  faceTriangle(ctx);
  ctx.clip();

  // 外周を一周する額縁の帯。立ち上がりに光、内側に影
  const frame = (inset: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, inset * 1.9);
    ctx.lineTo(SIZE - inset, SIZE - inset);
    ctx.lineTo(inset, SIZE - inset);
    ctx.closePath();
    ctx.stroke();
  };
  frame(30, C.edgeLit, 14);
  frame(34, 'rgba(96, 58, 10, 0.34)', 4);
  frame(44, 'rgba(96, 58, 10, 0.18)', 2);

  // 左下の階段状のブロック。実機で段が見えるのはここだけ
  const bw = SIZE * 0.15;
  const bx = 44;
  const by = SIZE - 26;
  for (let i = 0; i < 4; i += 1) {
    const h = 13;
    const w = bw - i * (bw / 6);
    ctx.fillStyle = 'rgba(96, 58, 10, 0.3)';
    ctx.fillRect(bx, by - i * h, w, h);
    ctx.fillStyle = C.edgeLit;
    ctx.fillRect(bx, by - i * h, w, 2.5);
  }

  // 斜面に散る小さな彫り。実機は面いっぱいに細かい石の飾りがある。
  // 目立たせすぎると段積みに見えるので、明暗の差は小さくする。
  let seed = 7919;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 90; i += 1) {
    const y = 120 + rnd() * (SIZE - 180);
    const e = edgesAt(y);
    const x = e.left + 26 + rnd() * (e.right - e.left - 52);
    const w = 6 + rnd() * 14;
    const h = 4 + rnd() * 7;
    ctx.fillStyle = 'rgba(96, 58, 10, 0.16)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255, 226, 168, 0.2)';
    ctx.fillRect(x, y, w, 2);
  }

  ctx.restore();

  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** 斜辺に沿った浅い縦筋。段差ではなく線彫りにとどめる */
function drawEdgePilasters(ctx: Ctx, dark: string, lit: string): void {
  ctx.save();
  faceTriangle(ctx);
  ctx.clip();
  for (let i = 0; i < 9; i += 1) {
    const y = 150 + i * 38;
    const { left, right } = edgesAt(y);
    for (const x of [left + 16, right - 16]) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 24);
      ctx.stroke();
      ctx.strokeStyle = lit;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 2.5, y);
      ctx.lineTo(x + 2.5, y + 24);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// --- 面ごとの仕掛け ------------------------------------------------------

/**
 * 面1 の操作パネル。実機はここだけにボタン列と銘板がある。
 * 上に紫の丸ボタンが 4 つ、その下に銀青の銘板。
 */
function drawControlPanel(ctx: Ctx, lit: boolean, ink: string): void {
  const bw = 172;
  const bx = SIZE / 2 - bw / 2;
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = lit ? '#000' : C.button;
    ctx.beginPath();
    ctx.arc(bx + 30 + i * 38, 190, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = lit ? '#000' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // 右端の小さなリセット
  ctx.fillStyle = lit ? '#000' : C.button;
  ctx.beginPath();
  ctx.arc(bx + bw - 4, 190, 6, 0, Math.PI * 2);
  ctx.fill();

  // 銘板。下辺がすこし広がる台形
  const pw = 206;
  const px = SIZE / 2 - pw / 2;
  const g = ctx.createLinearGradient(0, 210, 0, 246);
  g.addColorStop(0, lit ? '#000' : '#eef1f6');
  g.addColorStop(0.5, lit ? '#000' : C.silver);
  g.addColorStop(1, lit ? '#000' : '#8f96a4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(px + 8, 210);
  ctx.lineTo(px + pw - 8, 210);
  ctx.lineTo(px + pw, 246);
  ctx.lineTo(px, 246);
  ctx.closePath();
  ctx.fill();
  // 銘板の文字
  ctx.fillStyle = lit ? '#000' : C.plateBlue;
  // 環境によって字幅が変わるので、銘板に収まる大きさを測って決める
  const label = 'CYBER-LABYRINTH MEGALITH';
  let fontPx = 14;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (; fontPx > 6; fontPx -= 0.5) {
    ctx.font = `bold ${fontPx}px "Trebuchet MS", sans-serif`;
    if (ctx.measureText(label).width <= pw - 36) break;
  }
  ctx.fillText(label, SIZE / 2, 229);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // 右の青い START プレート
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, 382, 418, 68, 36, 5);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.plateBlue;
  roundRect(ctx, 386, 422, 60, 28, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : '#cfd6ea';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START', 416, 441);
  ctx.textAlign = 'start';

  // 左の青い扉プレート。4 枚の窓に分かれている
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, 56, 404, 72, 50, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.plateBlue;
  ctx.fillRect(60, 408, 64, 42);
  if (!lit) {
    ctx.strokeStyle = 'rgba(10, 16, 70, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(92, 408);
    ctx.lineTo(92, 450);
    ctx.moveTo(60, 429);
    ctx.lineTo(124, 429);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 165, 235, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(62, 410, 60, 38);
  }
  void ink;
}

/** 面4 のスコア窓。実機はアンバーの横長液晶 */
function drawScoreWindow(ctx: Ctx, lit: boolean): void {
  // 実機は横縦比 1.9:1 ほどの窓。中は無地の琥珀色で、
  // 数字の桁枠のようなものは出ていない。
  const w = 114;
  const h = 60;
  const x = SIZE / 2 - w / 2;
  const y = 194;
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 10, y - 10, w + 20, h + 20, 6);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.lcd;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  // 窓の上端だけ、ガラスの映り込みを薄く入れる
  if (!lit) {
    ctx.fillStyle = 'rgba(255, 236, 180, 0.16)';
    ctx.fillRect(x + 3, y + 3, w - 6, h * 0.3);
  }
}

/**
 * 面1 守護獣の叫び。
 * 実機は濃い青の円盤に同色のヒエログリフが浮き彫りされ、
 * 中心からサーモン色の円筒つまみが手前に突き出している。
 * 放射状の目盛りは入っていない（入れると時計に見えてしまう）。
 */
function faceDial(ctx: Ctx, ink: string, lit: boolean): void {
  drawControlPanel(ctx, lit, ink);

  const cx = SIZE / 2;
  const cy = 382;
  const r = 104;

  // 円盤を囲む石のカラー。外縁は不揃いにして岩肌にする
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  ctx.beginPath();
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    const rr = r + 20 + Math.sin(i * 2.7) * 4 + Math.cos(i * 1.3) * 3;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();

  // 青い円盤
  ctx.fillStyle = lit ? '#000' : C.blue;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 円盤に散るヒエログリフ。同じ青の濃淡で浮き彫りにする
  const glyphs: ((x: number, y: number, sc: number) => void)[] = [
    // 鳥
    (x, y, k) => { ctx.beginPath(); ctx.moveTo(x - 9*k, y + 6*k); ctx.lineTo(x, y - 7*k); ctx.lineTo(x + 9*k, y + 6*k); ctx.lineTo(x + 2*k, y + 3*k); ctx.lineTo(x + 3*k, y + 9*k); ctx.lineTo(x - 3*k, y + 9*k); ctx.closePath(); ctx.fill(); },
    // アンク
    (x, y, k) => { ctx.fillRect(x - 2*k, y - 2*k, 4*k, 12*k); ctx.fillRect(x - 7*k, y + 1*k, 14*k, 3.5*k); ctx.beginPath(); ctx.arc(x, y - 5*k, 4.5*k, 0, Math.PI*2); ctx.fill(); },
    // スカラベ
    (x, y, k) => { ctx.beginPath(); ctx.ellipse(x, y + 1*k, 6*k, 8*k, 0, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 8*k, 3.5*k, 0, Math.PI*2); ctx.fill(); },
    // 立ち姿
    (x, y, k) => { ctx.beginPath(); ctx.arc(x, y - 7*k, 3*k, 0, Math.PI*2); ctx.fill(); ctx.fillRect(x - 3*k, y - 3*k, 6*k, 8*k); ctx.fillRect(x - 3*k, y + 5*k, 2.5*k, 6*k); ctx.fillRect(x + 0.5*k, y + 5*k, 2.5*k, 6*k); },
  ];
  // 実機の円盤に金色は無い。同じ青の濃淡だけで浮き彫りを表す。
  // 大きな獣のレリーフが 6 個と、外周を巡る小さな文字。
  // 実機は獣や人の紋章が円盤いっぱいに散っている。
  // 内側の輪に 4 個、外側の輪に 6 個。
  const ring = (count: number, rad: number, rot: number, sc: number): void => {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + rot;
      const gx = cx + Math.cos(a) * rad;
      const gy = cy + Math.sin(a) * rad;
      if (!lit) {
        ctx.fillStyle = C.blueSunk;
        glyphs[(i + count) % glyphs.length](gx + 2.5, gy + 3.5, sc);
      }
      ctx.fillStyle = lit ? ink : C.blueRaised;
      glyphs[(i + count) % glyphs.length](gx, gy, sc);
    }
  };
  ring(4, r * 0.6, -Math.PI / 2 + 0.5, 1.6);
  ring(6, r * 0.86, -Math.PI / 2 + 0.25, 1.75);
  // 外周を巡る小さな文字。上側の弧だけに並ぶ
  for (let i = 0; i < 30; i += 1) {
    const a = -Math.PI * 1.16 + (i / 29) * Math.PI * 1.32;
    const gx = cx + Math.cos(a) * r * 0.92;
    const gy = cy + Math.sin(a) * r * 0.92;
    ctx.fillStyle = lit ? ink : C.blueRaised;
    ctx.fillRect(gx - 2, gy - 4, 4, 8);
    if (i % 3 === 0) ctx.fillRect(gx - 4, gy + 5, 8, 2.5);
  }
  // 小さな文字の列に沿う細い稜線。大レリーフとは重ねない
  ctx.strokeStyle = lit ? '#000' : C.blueRaised;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.79, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  // 中心の円筒つまみ。
  // 実機は円盤の 1/3 ほどの径で、径の半分ぐらい手前に突き出ている。
  // 溝は側面だけに入れること。上面まで伸ばすと目盛りに見えてしまう。
  const kr = r * 0.36;
  const lift = kr * 0.55;

  // 落ち影
  ctx.fillStyle = lit ? '#000' : 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + lift + 6, kr * 1.06, kr * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();

  // 側面。下へずらした円で厚みを出す
  ctx.fillStyle = lit ? '#000' : C.knobSide;
  ctx.beginPath();
  ctx.arc(cx, cy + lift, kr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - kr, cy, kr * 2, lift);

  // 側面の縦フルート。上面にはかからない
  ctx.strokeStyle = lit ? '#000' : 'rgba(96, 46, 12, 0.75)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i += 1) {
    const a = (i / 40) * Math.PI * 2;
    const x = cx + Math.cos(a) * kr * 0.97;
    if (Math.sin(a) < -0.2) continue; // 裏側は見えない
    ctx.beginPath();
    ctx.moveTo(x, cy + Math.sin(a) * kr * 0.12);
    ctx.lineTo(x, cy + lift + Math.sin(a) * kr * 0.12);
    ctx.stroke();
  }

  // 上面
  ctx.fillStyle = lit ? '#000' : C.knobTop;
  ctx.beginPath();
  ctx.arc(cx, cy, kr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? '#000' : 'rgba(110, 58, 20, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, kr * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // 12 時の指標
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - r - 26);
  ctx.lineTo(cx + 12, cy - r - 26);
  ctx.lineTo(cx, cy - r - 6);
  ctx.closePath();
  ctx.fill();
}

/**
 * 面2 大蛇の回廊。
 * 実機は紺色の壁が 5 周する深い溝で、その中を鉄球が転がる。
 * 溝の断面を出すため、暗い谷と明るい立ち上がりを重ねて描く。
 */
function faceSpiral(ctx: Ctx, ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const cy = 366;
  const r = 126;

  // 外周は割れた岩の縁。真円にしない
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  ctx.beginPath();
  for (let i = 0; i <= 84; i += 1) {
    const a = (i / 84) * Math.PI * 2;
    const rr = r + 18 + Math.sin(i * 2.3) * 5 + Math.cos(i * 1.1) * 4;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = lit ? '#000' : C.blueDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.blue;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const turns = 4;
  const r0 = r * 0.9;
  const spiralAt = (deg: number) => {
    const th = (deg * Math.PI) / 180 + Math.PI / 2;
    const rr = r0 - (r0 * 0.84 * deg) / (360 * turns);
    return { x: cx + Math.cos(th) * rr, y: cy + Math.sin(th) * rr };
  };
  const strokeSpiral = (color: string, width: number, dx = 0, dy = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let d = 0; d <= 360 * turns; d += 3) {
      const p = spiralAt(d);
      if (d === 0) ctx.moveTo(p.x + dx, p.y + dy);
      else ctx.lineTo(p.x + dx, p.y + dy);
    }
    ctx.stroke();
  };

  // 実機は「青い壁が太く、その間の溝が細い」。
  // 円盤を青で塗ったうえに、細い溝だけを暗く彫る。
  strokeSpiral(lit ? '#000' : '#0a1038', 11);
  strokeSpiral(lit ? '#000' : '#131c62', 7, 0, -1);
  // 壁の上側の稜に光を乗せる
  strokeSpiral(lit ? '#000' : 'rgba(150, 170, 245, 0.35)', 2.5, 0, -7.5);

  // 中心の穴と赤い表示灯
  ctx.fillStyle = lit ? '#000' : '#07070c';
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? ink : '#ff2a18';
  ctx.beginPath();
  ctx.arc(cx + 3, cy + 20, 7, 0, Math.PI * 2);
  ctx.fill();

  // 溝を転がる鉄球
  if (!lit) {
    const b = spiralAt(360 * 1.6);
    ctx.fillStyle = '#d8dce4';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 下部の脱出口と、右下の青い岩塊
  ctx.fillStyle = lit ? '#000' : '#07070c';
  roundRect(ctx, cx - 16, cy + r - 6, 32, 40, 6);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.blueLit;
  ctx.beginPath();
  ctx.moveTo(cx + r - 18, cy + r * 0.52);
  ctx.quadraticCurveTo(cx + r + 34, cy + r * 0.5, cx + r + 26, cy + r * 0.86);
  ctx.quadraticCurveTo(cx + r + 18, cy + r * 1.16, cx + r - 12, cy + r * 1.02);
  ctx.quadraticCurveTo(cx + r - 34, cy + r * 0.8, cx + r - 18, cy + r * 0.52);
  ctx.closePath();
  ctx.fill();
  if (!lit) {
    ctx.fillStyle = '#0a1038';
    ctx.beginPath();
    ctx.ellipse(cx + r + 6, cy + r * 0.72, 5, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 面3 封印の扉。
 * 実機は深く落ち込んだ開口で、奥壁は枠よりはっきり暗い。
 * 中央下にネメス頭巾のファラオ胸像が立ち、その下に幅広の階段が降りる。
 * 左右の柱には立像が 1 体ずつ。丸い青灰色のレンズが像を挟んで並ぶ。
 */
function faceDoor(ctx: Ctx, _ink: string, lit: boolean): void {
  const cx = SIZE / 2;
  const top = 250;
  const w = 268;
  const h = 214;
  const x = cx - w / 2;

  // 段状の金枠
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 22, top - 22, w + 44, h + 44, 5);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  roundRect(ctx, x - 13, top - 13, w + 26, h + 26, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyHi;
  ctx.fillRect(x - 28, top - 42, w + 56, 22);

  // まぐさの上に広げた翼の浮き彫り
  if (!lit) {
    const wy = top - 52;
    ctx.fillStyle = C.bodyDark;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 14, wy);
      ctx.quadraticCurveTo(cx + dir * 70, wy - 8, cx + dir * 104, wy + 2);
      ctx.lineTo(cx + dir * 96, wy + 9);
      ctx.quadraticCurveTo(cx + dir * 60, wy + 6, cx + dir * 14, wy + 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = C.bodyHi;
    ctx.beginPath();
    ctx.arc(cx, wy + 5, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.bodyDark;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 奥壁。枠より暗い青灰にして凹みを出す
  ctx.fillStyle = lit ? '#000' : C.chamber;
  ctx.fillRect(x, top, w, h);
  // 開口上辺の接触影
  const sh = ctx.createLinearGradient(0, top, 0, top + h * 0.16);
  sh.addColorStop(0, lit ? '#000' : 'rgba(0,0,0,0.6)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, top, w, h * 0.16);

  // 角丸正方形のタイル。6 列 x 4 段に並べ、
  // 中央 2 列の下 3 段だけは胸像に譲る
  const cols = 6;
  const rows = 4;
  const pad = 16;
  const cw = (w - pad * 2) / cols;
  const ch = (h - pad * 2 - 26) / rows;
  const side = Math.min(cw, ch) * 0.74;
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const middle = col === 2 || col === 3;
      if (middle && row > 0) continue;
      const lx = x + pad + cw * (col + 0.5) - side / 2;
      const ly = top + pad + ch * (row + 0.5) - side / 2;
      ctx.fillStyle = lit ? '#000' : C.lampOff;
      roundRect(ctx, lx, ly, side, side, side * 0.22);
      ctx.fill();
      ctx.strokeStyle = lit ? '#000' : 'rgba(30, 40, 50, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 中央のファラオ胸像。奥の暗がりに立つので金は落ち着いた色にする
  const gold = lit ? '#000' : '#b8883a';
  const goldLit = lit ? '#000' : '#d6a75a';
  const fy = top + h * 0.42;
  const fw = w * 0.165;
  ctx.fillStyle = gold;
  // ネメス頭巾
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.82, fy + fw * 0.3);
  ctx.quadraticCurveTo(cx - fw * 0.82, fy - fw * 0.85, cx, fy - fw * 0.85);
  ctx.quadraticCurveTo(cx + fw * 0.82, fy - fw * 0.85, cx + fw * 0.82, fy + fw * 0.3);
  ctx.lineTo(cx + fw * 1.05, fy + fw * 1.45);
  ctx.lineTo(cx - fw * 1.05, fy + fw * 1.45);
  ctx.closePath();
  ctx.fill();
  // 頭巾の縞
  if (!lit) {
    ctx.fillStyle = 'rgba(40, 46, 60, 0.45)';
    ctx.fillRect(cx - fw * 0.72, fy - fw * 0.5, fw * 1.44, fw * 0.16);
    ctx.fillRect(cx - fw * 0.78, fy - fw * 0.22, fw * 1.56, fw * 0.14);
  }
  // 顔
  ctx.fillStyle = goldLit;
  roundRect(ctx, cx - fw * 0.42, fy - fw * 0.22, fw * 0.84, fw * 1.05, fw * 0.24);
  ctx.fill();
  if (!lit) {
    ctx.fillStyle = 'rgba(25, 30, 40, 0.7)';
    ctx.fillRect(cx - fw * 0.26, fy + fw * 0.16, fw * 0.16, fw * 0.1);
    ctx.fillRect(cx + fw * 0.1, fy + fw * 0.16, fw * 0.16, fw * 0.1);
    // つけひげ
    ctx.fillStyle = gold;
    ctx.fillRect(cx - fw * 0.08, fy + fw * 0.8, fw * 0.16, fw * 0.4);
  }
  // 襟飾りと、胸の前で組んだ腕
  ctx.fillStyle = gold;
  roundRect(ctx, cx - fw * 1.55, fy + fw * 1.45, fw * 3.1, fw * 1.15, 5);
  ctx.fill();
  // 広い襟飾り
  ctx.fillStyle = goldLit;
  ctx.beginPath();
  ctx.moveTo(cx - fw * 1.2, fy + fw * 1.5);
  ctx.quadraticCurveTo(cx, fy + fw * 2.2, cx + fw * 1.2, fy + fw * 1.5);
  ctx.lineTo(cx + fw * 1.45, fy + fw * 1.5);
  ctx.quadraticCurveTo(cx, fy + fw * 2.6, cx - fw * 1.45, fy + fw * 1.5);
  ctx.closePath();
  ctx.fill();
  // 胸の前で組んだ腕
  ctx.fillStyle = gold;
  ctx.fillRect(cx - fw * 1.35, fy + fw * 2.05, fw * 2.7, fw * 0.34);

  // 像の下に降りる、幅広で低い 4 段の階段
  for (let i = 0; i < 4; i += 1) {
    const sw = w * 0.4 + i * (w * 0.1);
    const sy = top + h - 10 - (3 - i) * 10;
    ctx.fillStyle = lit ? '#000' : i % 2 ? '#8d6b31' : '#9c7737';
    ctx.fillRect(cx - sw / 2, sy, sw, 10);
  }

  // 枠の柱に立つミイラ形の立像。凹みの外側に置く
  for (const sideDir of [-1, 1]) {
    const px = cx + sideDir * (w / 2 + 6);
    const py = top + 26;
    const ph = h - 54;
    // 落ち影を先に置いて、枠から浮かせる
    if (!lit) {
      ctx.fillStyle = 'rgba(80, 46, 8, 0.45)';
      ctx.fillRect(px - 14 + 4, py - 6 + 5, 28, ph + 10);
    }
    ctx.fillStyle = lit ? '#000' : C.bodyHi;
    // 体（下にすぼまる細長い形）
    ctx.beginPath();
    ctx.moveTo(px - 13, py + 16);
    ctx.lineTo(px + 13, py + 16);
    ctx.lineTo(px + 9, py + ph);
    ctx.lineTo(px - 9, py + ph);
    ctx.closePath();
    ctx.fill();
    // 頭巾つきの頭
    ctx.beginPath();
    ctx.moveTo(px - 12, py + 18);
    ctx.quadraticCurveTo(px - 12, py - 6, px, py - 6);
    ctx.quadraticCurveTo(px + 12, py - 6, px + 12, py + 18);
    ctx.closePath();
    ctx.fill();
    if (!lit) {
      // 胸の前で組んだ腕を 2 本の帯で表す
      ctx.fillStyle = 'rgba(90, 56, 14, 0.5)';
      ctx.fillRect(px - 12, py + 34, 24, 5);
      ctx.fillRect(px - 12, py + 46, 24, 5);
      ctx.fillRect(px - 11, py + ph * 0.62, 22, 4);
    }
  }
}

/**
 * 面4 呪われた谷。
 * 実機は素地の上に丸棒が直接張られ、上下 2 段に折り重なった
 * 角ばった迷路になっている。折返しは合わせて 20 か所以上あり、
 * 幅も高さも面のかなりの範囲を占める。
 */
function faceWire(ctx: Ctx, ink: string, lit: boolean): void {
  drawScoreWindow(ctx, lit);

  // 実機の針金は、規則的な蛇行ではなく、あちこちに折り返しながら
  // 面いっぱいを這う不定形の曲線。写真をなぞって決めた形を使う。
  // x は -1〜1 で、その高さで使える幅いっぱいに割り当てる。
  const path: [number, number][] = [
    [-0.90, 0.38], [-0.66, 0.12], [-0.78, -0.22], [-0.52, -0.46],
    [-0.28, -0.28], [-0.40, 0.06], [-0.16, 0.26], [0.03, -0.04],
    [-0.04, -0.44], [0.20, -0.60], [0.42, -0.38], [0.27, -0.06],
    [0.45, 0.20], [0.68, 0.03], [0.80, -0.28], [0.94, 0.06],
    [0.76, 0.42], [0.46, 0.52], [0.18, 0.40], [-0.08, 0.56],
    [-0.38, 0.46],
  ];
  const cy = 372;
  const hh = 118;
  const margin = 30;
  const pts: [number, number][] = path.map(([nx, ny]) => {
    // 元の値は -0.6〜0.56 に収まっているので、上下いっぱいまで広げる
    const y = cy + ny * 1.62 * hh;
    const e = edgesAt(y);
    const half = (e.right - e.left) / 2 - margin;
    return [SIZE / 2 + nx * half, y];
  });

  // 折返しを鈍らせたくないので、点を必ず通る曲線でつなぐ
  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    const at = (i: number): [number, number] =>
      pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      );
    }
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 落ち影。素地から浮いていることを示す
  if (!lit) {
    ctx.save();
    ctx.translate(5, 7);
    ctx.strokeStyle = 'rgba(70, 40, 6, 0.35)';
    ctx.lineWidth = 18;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  // 丸棒
  ctx.strokeStyle = lit ? '#000' : C.groove;
  ctx.lineWidth = 18;
  trace();
  ctx.stroke();
  // 上側のハイライトで丸みを出す
  if (!lit) {
    ctx.save();
    ctx.translate(-1.5, -3);
    ctx.strokeStyle = 'rgba(150, 150, 156, 0.5)';
    ctx.lineWidth = 5;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  // 輪と青い持ち手。実機は右下から黒いコードで垂れている
  const hx = pts[16][0];
  const hy = pts[16][1];
  ctx.strokeStyle = lit ? ink : '#d8d2c4';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(hx, hy, 21, 0, Math.PI * 2);
  ctx.stroke();
  // 金属の軸
  ctx.strokeStyle = lit ? '#000' : '#b9bcc4';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(hx + 14, hy + 16);
  ctx.lineTo(hx + 32, hy + 36);
  ctx.stroke();
  // 青いグリップ
  ctx.strokeStyle = lit ? '#000' : C.handle;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(hx + 32, hy + 36);
  ctx.lineTo(hx + 62, hy + 70);
  ctx.stroke();
  // 黒いコード
  ctx.strokeStyle = lit ? '#000' : 'rgba(20,20,20,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hx + 62, hy + 70);
  ctx.quadraticCurveTo(hx + 40, hy + 118, cxOfCable(), SIZE - 22);
  ctx.stroke();
}

/** コードが素地に潜る位置 */
function cxOfCable(): number {
  return SIZE / 2 - 40;
}

const FACES = [faceDial, faceSpiral, faceDoor, faceWire];

/** 面の中身を描く。lit を立てると発光用の描き方になる */
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
  drawEdgePilasters(c, 'rgba(96, 58, 10, 0.4)', 'rgba(255, 226, 168, 0.28)');
  drawFaceContent(c, index, 'rgba(70, 40, 6, 0.85)', false);

  // --- 凹凸。黒いほど凹んで見える ---
  const { cv: bump, ctx: b } = newCanvas();
  // 実機の斜面は一枚の平滑な面。
  // ここに横線を並べると段積みに見えてしまうので、凹凸にも入れない。
  b.fillStyle = '#909090';
  b.fillRect(0, 0, SIZE, SIZE);
  {
    // 外周の額縁だけを立ち上げる
    b.save();
    faceTriangle(b);
    b.clip();
    b.strokeStyle = '#d0d0d0';
    b.lineWidth = 14;
    b.beginPath();
    b.moveTo(SIZE / 2, 57);
    b.lineTo(SIZE - 30, SIZE - 30);
    b.lineTo(30, SIZE - 30);
    b.closePath();
    b.stroke();
    b.strokeStyle = '#3a3a3a';
    b.lineWidth = 4;
    b.beginPath();
    b.moveTo(SIZE / 2, 65);
    b.lineTo(SIZE - 38, SIZE - 36);
    b.lineTo(38, SIZE - 36);
    b.closePath();
    b.stroke();
    b.restore();
  }
  drawEdgePilasters(b, '#404040', '#c8c8c8');
  drawFaceContent(b, index, '#202020', false);

  // --- 発光。仕掛けの要所だけ灯す ---
  const { cv: glow, ctx: g } = newCanvas();
  g.fillStyle = '#000000';
  g.fillRect(0, 0, SIZE, SIZE);
  drawFaceContent(g, index, '#ffcf9a', true);

  return { color, bump, glow };
}
