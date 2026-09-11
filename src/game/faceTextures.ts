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
  blue: '#2f3f9e',
  /** 円盤に並ぶ金の文字 */
  gold: '#c9a227',
  /** 銘板の銀 */
  silver: '#c8ccd4',
  blueLit: '#4a5cb8',
  blueDark: '#16215c',
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
  handle: '#5a4ab0',
  /** 光る板 */
  lampOff: '#cfc4b0',
  /** 操作ボタン。実機は濃紺 */
  button: '#3b3ba8',
  /** 銘板の濃い青 */
  plateBlue: '#1b2890',
  /** 液晶のアンバー */
  lcd: '#c8a24a',
  /** 祭室の奥。実機は暗い穴ではなく明るい */
  chamber: '#e0b374',
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
  const bx = 54;
  const by = SIZE - 44;
  for (let i = 0; i < 5; i += 1) {
    const h = 13;
    const w = bw - i * (bw / 6);
    ctx.fillStyle = 'rgba(96, 58, 10, 0.3)';
    ctx.fillRect(bx, by - i * h, w, h);
    ctx.fillStyle = C.edgeLit;
    ctx.fillRect(bx, by - i * h, w, 2.5);
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
  const pw = 180;
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
  // 銘板の文字の帯
  ctx.fillStyle = lit ? '#000' : C.plateBlue;
  ctx.fillRect(px + 22, 221, pw - 44, 6);
  ctx.fillRect(px + 34, 232, pw - 68, 4);
  void ink;
}

/** 面4 のスコア窓。実機はアンバーの横長液晶 */
function drawScoreWindow(ctx: Ctx, lit: boolean): void {
  const w = 116;
  const h = 46;
  const x = SIZE / 2 - w / 2;
  const y = 196;
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 10, y - 10, w + 20, h + 20, 6);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.lcd;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  // 表示の桁
  ctx.fillStyle = lit ? '#000' : 'rgba(60, 40, 6, 0.55)';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(x + 20 + i * 28, y + 14, 16, 20);
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
  const cy = 366;
  const r = 118;

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
  // 外周に 16 個、内側に 8 個。実機は金の文字がぎっしり並ぶ
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = lit ? ink : C.gold;
    glyphs[i % glyphs.length](
      cx + Math.cos(a) * r * 0.84,
      cy + Math.sin(a) * r * 0.84,
      0.62,
    );
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + 0.2;
    ctx.fillStyle = lit ? ink : C.gold;
    glyphs[(i + 1) % glyphs.length](
      cx + Math.cos(a) * r * 0.58,
      cy + Math.sin(a) * r * 0.58,
      0.9,
    );
  }
  // 円盤外周の金の細リング
  ctx.strokeStyle = lit ? '#000' : C.gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.stroke();

  // 中心の円筒つまみ。
  // 実機は円盤の 1/3 ほどの径で、径の半分ぐらい手前に突き出ている。
  // 溝は側面だけに入れること。上面まで伸ばすと目盛りに見えてしまう。
  const kr = r * 0.33;
  const lift = kr * 0.45;

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
  ctx.strokeStyle = lit ? '#000' : 'rgba(110, 58, 20, 0.5)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
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

  const turns = 5;
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

  // 壁の厚み → 溝の谷 → 立ち上がりの光、の順に重ねて断面を作る
  strokeSpiral(lit ? '#000' : '#0d1440', 17);
  strokeSpiral(lit ? '#000' : '#1a2a70', 11, 0, -1.5);
  strokeSpiral(lit ? '#000' : 'rgba(140, 160, 240, 0.5)', 2.5, 0, -4);

  // 中心の穴と赤い表示灯
  ctx.fillStyle = lit ? '#000' : '#07070c';
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? ink : '#ff2a18';
  ctx.beginPath();
  ctx.arc(cx + 26, cy - 22, 6, 0, Math.PI * 2);
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
  roundRect(ctx, cx + r - 22, cy + r * 0.55, 44, 54, 12);
  ctx.fill();
}

/**
 * 面3 封印の扉。
 * 奥まった暗い祭室にマットな青灰色の板が並び、中央に座像が彫られている。
 * 実機の板は光らないので、発光用の絵でもここは灯さない。
 */
function faceDoor(ctx: Ctx, _ink: string, lit: boolean): void {

  const cx = SIZE / 2;
  const top = 252;
  const w = 260;
  const h = 218;
  const x = cx - w / 2;

  // 枠とまぐさ石
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 14, top - 14, w + 28, h + 28, 6);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  ctx.fillRect(x - 24, top - 36, w + 48, 24);

  // 奥の空間
  ctx.fillStyle = lit ? '#000' : C.chamber;
  ctx.fillRect(x, top, w, h);

  // 光る板。中央の像を囲むように並べる
  const cell = 40;
  const gap = 6;
  const slots: [number, number][] = [];
  for (let col = 0; col < 5; col += 1) {
    slots.push([col, 0]);
    slots.push([col, 3]);
  }
  for (const row of [1, 2]) {
    slots.push([0, row]);
    slots.push([4, row]);
  }
  const gx = x + (w - (cell * 5 + gap * 4)) / 2;
  const gy = top + 12;
  for (const [col, row] of slots) {
    // 実機の板はマットで光らないので、発光用でも灯さない
    ctx.fillStyle = lit ? '#000' : C.lampOff;
    const sx = gx + col * (cell + gap);
    const sy = gy + row * (cell + gap);
    roundRect(ctx, sx, sy, cell, cell, 3);
    ctx.fill();
    // 板に刻まれた記号
    if (!lit) {
      ctx.fillStyle = 'rgba(40, 52, 60, 0.55)';
      ctx.fillRect(sx + 10, sy + 8, cell - 20, 4);
      ctx.fillRect(sx + 13, sy + 17, cell - 26, 4);
      ctx.fillRect(sx + 10, sy + 26, cell - 20, 4);
    }
  }

  // 中央のファラオ像
  const fx = cx;
  const fy = top + 74;
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  // ネメス頭巾
  ctx.beginPath();
  ctx.moveTo(fx - 26, fy + 6);
  ctx.quadraticCurveTo(fx - 26, fy - 26, fx, fy - 26);
  ctx.quadraticCurveTo(fx + 26, fy - 26, fx + 26, fy + 6);
  ctx.lineTo(fx + 32, fy + 42);
  ctx.lineTo(fx - 32, fy + 42);
  ctx.closePath();
  ctx.fill();
  // 顔
  ctx.fillStyle = lit ? '#000' : C.body;
  roundRect(ctx, fx - 15, fy - 8, 30, 34, 8);
  ctx.fill();
  // 胸と腕
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  roundRect(ctx, fx - 38, fy + 42, 76, 44, 6);
  ctx.fill();
  // 膝から下
  roundRect(ctx, fx - 30, fy + 86, 60, 32, 5);
  ctx.fill();
  // つけひげ
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  ctx.fillRect(fx - 5, fy + 24, 10, 20);
}

/**
 * 面4 呪われた谷。
 * 実機は直角のない有機的な曲線の丸棒が、素地の上に浮いて張られている。
 * 受け皿のパネルは無く、棒が直接ついていて落ち影が出る。
 */
function faceWire(ctx: Ctx, ink: string, lit: boolean): void {
  drawScoreWindow(ctx, lit);

  const cx = SIZE / 2;
  const cy = 372;
  const w = 330;
  const h = 220;

  // 曲線の経路。折れではなく滑らかにつなぐ
  const pts: [number, number][] = [
    [-0.96, 0.78], [-0.80, 0.10], [-0.92, -0.48], [-0.55, -0.72],
    [-0.30, -0.30], [-0.48, 0.24], [-0.10, 0.52], [0.18, 0.06],
    [0.02, -0.52], [0.38, -0.78], [0.66, -0.40], [0.48, 0.14],
    [0.76, 0.52], [0.96, 0.10],
  ];
  const trace = () => {
    ctx.beginPath();
    const P = (i: number) => ({
      x: cx + pts[i][0] * (w / 2),
      y: cy + pts[i][1] * (h / 2),
    });
    const a = P(0);
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const c = P(i);
      const n = P(i + 1);
      ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
    }
    const last = P(pts.length - 1);
    ctx.lineTo(last.x, last.y);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 落ち影。素地から浮いていることを示す
  if (!lit) {
    ctx.save();
    ctx.translate(5, 7);
    ctx.strokeStyle = 'rgba(70, 40, 6, 0.35)';
    ctx.lineWidth = 15;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  // 丸棒
  ctx.strokeStyle = lit ? '#000' : C.groove;
  ctx.lineWidth = 15;
  trace();
  ctx.stroke();
  // 上側のハイライトで丸みを出す
  if (!lit) {
    ctx.save();
    ctx.translate(-1.5, -2.5);
    ctx.strokeStyle = 'rgba(150, 150, 156, 0.5)';
    ctx.lineWidth = 4;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  // 輪と紫のグリップ
  const hx = cx + 0.18 * (w / 2);
  const hy = cy + 0.06 * (h / 2);
  ctx.strokeStyle = lit ? ink : '#d8d2c4';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(hx, hy, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = lit ? '#000' : C.handle;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(hx + 15, hy + 17);
  ctx.lineTo(hx + 58, hy + 66);
  ctx.stroke();
  // 黒いコード
  ctx.strokeStyle = lit ? '#000' : 'rgba(20,20,20,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hx + 58, hy + 66);
  ctx.quadraticCurveTo(hx + 30, hy + 110, cx - 40, SIZE - 24);
  ctx.stroke();
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
  b.fillStyle = '#909090';
  b.fillRect(0, 0, SIZE, SIZE);
  {
    const courses = 20;
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
  drawEdgePilasters(b, '#303030', '#d8d8d8');
  drawFaceContent(b, index, '#202020', false);

  // --- 発光。仕掛けの要所だけ灯す ---
  const { cv: glow, ctx: g } = newCanvas();
  g.fillStyle = '#000000';
  g.fillRect(0, 0, SIZE, SIZE);
  drawFaceContent(g, index, '#ffcf9a', true);

  return { color, bump, glow };
}
