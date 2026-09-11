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
  /** 円盤の浮き彫り。同じ青の明暗で表す */
  blueRaised: '#4a5cc8',
  blueSunk: '#1c2668',
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
  lampOff: '#8fa3a8',
  /** 操作ボタン。実機は濃紺 */
  button: '#3b3ba8',
  /** 銘板の濃い青 */
  plateBlue: '#1b2890',
  /** 液晶のアンバー。実機は暗めの琥珀 */
  lcd: '#9d7a2a',
  /** 祭室の奥。枠より一段暗く落として奥行きを出す */
  chamber: '#6b5a3a',
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
  // 実機は横縦比 2.2:1 ほどの横長窓
  const w = 112;
  const h = 51;
  const x = SIZE / 2 - w / 2;
  const y = 196;
  ctx.fillStyle = lit ? '#000' : C.bodyDark;
  roundRect(ctx, x - 10, y - 10, w + 20, h + 20, 6);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.lcd;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  // 液晶らしく、うっすら桁の影を落とす
  ctx.fillStyle = lit ? '#000' : 'rgba(50, 38, 8, 0.35)';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 14 + i * 24, y + 12, 13, 22);
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
  // 実機の円盤に金色は無い。同じ青の濃淡だけで浮き彫りを表す。
  // 大きな獣のレリーフが 6 個と、外周を巡る小さな文字。
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + 0.15;
    const gx = cx + Math.cos(a) * r * 0.6;
    const gy = cy + Math.sin(a) * r * 0.6;
    ctx.fillStyle = lit ? ink : C.blueRaised;
    glyphs[i % glyphs.length](gx, gy, 1.15);
    if (!lit) {
      ctx.fillStyle = C.blueSunk;
      glyphs[i % glyphs.length](gx + 1.5, gy + 2, 1.15);
    }
  }
  // 外周を巡る小さな文字。上側の弧だけに並ぶ
  for (let i = 0; i < 30; i += 1) {
    const a = -Math.PI * 1.18 + (i / 29) * Math.PI * 1.36;
    const gx = cx + Math.cos(a) * r * 0.88;
    const gy = cy + Math.sin(a) * r * 0.88;
    ctx.fillStyle = lit ? ink : C.blueRaised;
    ctx.fillRect(gx - 2.5, gy - 5, 5, 10);
    if (i % 3 === 0) ctx.fillRect(gx - 5, gy + 6, 10, 3);
  }
  // 大レリーフをつなぐ弓なりの稜線
  ctx.strokeStyle = lit ? '#000' : C.blueRaised;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();

  // 中心の円筒つまみ。
  // 実機は円盤の 1/3 ほどの径で、径の半分ぐらい手前に突き出ている。
  // 溝は側面だけに入れること。上面まで伸ばすと目盛りに見えてしまう。
  const kr = r * 0.29;
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
  roundRect(ctx, x - 20, top - 20, w + 40, h + 40, 5);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyLit;
  roundRect(ctx, x - 12, top - 12, w + 24, h + 24, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#000' : C.bodyHi;
  ctx.fillRect(x - 26, top - 40, w + 52, 22);

  // 奥壁。枠より暗くして凹みを出す
  ctx.fillStyle = lit ? '#000' : C.chamber;
  ctx.fillRect(x, top, w, h);
  // 開口上辺の接触影
  const sh = ctx.createLinearGradient(0, top, 0, top + h * 0.12);
  sh.addColorStop(0, lit ? '#000' : 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, top, w, h * 0.12);

  // 丸いレンズ。像を挟んで左右に 2 列 x 3 段
  const lr = w / 18;
  for (const side of [-1, 1]) {
    for (let col = 0; col < 2; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const lx = cx + side * (w * 0.18 + col * lr * 2.6);
        const ly = top + 42 + row * lr * 2.9;
        ctx.fillStyle = lit ? '#000' : C.lampOff;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = lit ? '#000' : 'rgba(40, 52, 60, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // 中央のファラオ胸像
  const fy = top + h * 0.3;
  const fw = w * 0.18;
  ctx.fillStyle = lit ? '#000' : '#d9a23f';
  // ネメス頭巾
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.8, fy + fw * 0.3);
  ctx.quadraticCurveTo(cx - fw * 0.8, fy - fw * 0.8, cx, fy - fw * 0.8);
  ctx.quadraticCurveTo(cx + fw * 0.8, fy - fw * 0.8, cx + fw * 0.8, fy + fw * 0.3);
  ctx.lineTo(cx + fw, fy + fw * 1.5);
  ctx.lineTo(cx - fw, fy + fw * 1.5);
  ctx.closePath();
  ctx.fill();
  // 顔
  ctx.fillStyle = lit ? '#000' : '#e8bd6c';
  roundRect(ctx, cx - fw * 0.45, fy - fw * 0.25, fw * 0.9, fw * 1.15, fw * 0.25);
  ctx.fill();
  // 胸飾りと胴
  ctx.fillStyle = lit ? '#000' : '#d9a23f';
  roundRect(ctx, cx - fw * 1.15, fy + fw * 1.5, fw * 2.3, fw * 1.5, 4);
  ctx.fill();

  // 像の下の幅広い階段
  const stW = w * 0.42;
  for (let i = 0; i < 5; i += 1) {
    const sw = stW + i * (w * 0.06);
    const sy = top + h - 8 - (4 - i) * 13;
    ctx.fillStyle = lit ? '#000' : (i % 2 ? '#c08a42' : '#d09a4e');
    ctx.fillRect(cx - sw / 2, sy, sw, 13);
  }

  // 左右の柱に立つ像
  for (const side of [-1, 1]) {
    const px = cx + side * (w * 0.44);
    const py = top + h * 0.18;
    const ph = h * 0.7;
    ctx.fillStyle = lit ? '#000' : '#c89a58';
    ctx.beginPath();
    ctx.arc(px, py, ph * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - ph * 0.1, py + ph * 0.08, ph * 0.2, ph * 0.42);
    ctx.fillRect(px - ph * 0.1, py + ph * 0.5, ph * 0.08, ph * 0.4);
    ctx.fillRect(px + ph * 0.02, py + ph * 0.5, ph * 0.08, ph * 0.4);
  }
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
  // 実機は U 字の折返しが 15 回ほど続く密な蛇行
  const pts: [number, number][] = [
    [-0.97, 0.80], [-0.88, 0.16], [-0.97, -0.40], [-0.74, -0.78],
    [-0.56, -0.36], [-0.66, 0.22], [-0.44, 0.70], [-0.26, 0.20],
    [-0.36, -0.40], [-0.16, -0.80], [0.04, -0.36], [-0.06, 0.24],
    [0.14, 0.72], [0.32, 0.24], [0.22, -0.36], [0.42, -0.80],
    [0.62, -0.40], [0.52, 0.20], [0.72, 0.66], [0.90, 0.20],
    [0.97, -0.30],
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
    ctx.lineWidth = 11;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  // 丸棒
  ctx.strokeStyle = lit ? '#000' : C.groove;
  ctx.lineWidth = 11;
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
