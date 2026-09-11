/**
 * ステージ選択の 3D ピラミッド。
 *
 * 4 つの側面がそれぞれの試練にあたる。指で回すと慣性で回り続け、
 * 手を離すといちばん手前の面に吸い付いて止まる。
 * アドベンチャーモードでは、外から回転と寄り引きを指示して見せる。
 */

import {
  AdditiveBlending,
  BoxGeometry,
  NoToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { buildFaceArt } from './faceTextures';

/** 底面の一辺の半分 */
const HALF = 1.0;
/** 頂点までの高さ */
const HEIGHT = 1.15;
/** 面の数 */
export const FACE_COUNT = 4;

/** 1 面ぶんの角度 (rad) */
const STEP = (Math.PI * 2) / FACE_COUNT;

/** 手を離したあとの減衰。1 に近いほど長く回り続ける */
const SPIN_DAMP = 0.9;
/** 目盛りに吸い付く強さ */
const SNAP_PULL = 11;
/** これ以下の速さになったら吸い付きを始める */
const SNAP_ENTER = 2.2;
/**
 * 弾いたときの速さの上限 (rad/s)。
 * ここが大きいと、軽く払っただけで何面も回り過ぎてしまう。
 * 1 面 = 90 度なので、この値で「勢いよく弾いて 1〜2 面」に収まる。
 */
const MAX_FLING = 5;

export interface PyramidOptions {
  /** 面が変わったときに呼ばれる */
  onFaceChange?: (index: number) => void;
  /** 面を選び切ったときに呼ばれる（手を離して止まったとき） */
  onSettle?: (index: number) => void;
  /** 面が押されたときに呼ばれる */
  onPick?: (index: number) => void;
}

export class PyramidView {
  readonly el: HTMLElement;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private pivot = new Group();
  private faces: Mesh[] = [];
  private glowMats: MeshBasicMaterial[] = [];
  private capCore!: Mesh;
  private capLight: PointLight;
  private opts: PyramidOptions;

  /** いまの回転角 (rad)。0 のとき面 0 が正面 */
  private angle = 0;
  private spin = 0;
  private dragging = false;
  private lastX = 0;
  private lastMoveAt = 0;
  private pointerMoved = false;
  private downAt = 0;

  /** 吸い付き先。null なら自由に回る */
  private target: number | null = 0;
  private current = 0;

  /** カメラの引き具合。1 が標準、大きいほど遠い */
  private zoom = 1;
  private zoomTarget = 1;
  /** カメラの高さ。0 で真横、大きいほど見下ろす */
  private lift = 1;
  private liftTarget = 1;
  /** 寄り引きの追従の速さ。演出ごとに変える */
  private camEase = 3.2;

  /** 選択の演出の進み具合 (0..1) */
  private pick = 0;
  private pickTarget = 0;

  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private interactive = true;

  constructor(opts: PyramidOptions = {}) {
    this.opts = opts;

    this.el = document.createElement('div');
    this.el.className = 'mg-pyramid3d';

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.el.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(38, 1, 0.1, 100);

    this.buildLights();
    this.buildCapstone();
    this.capLight = new PointLight(0xfcc09c, 0, 6, 2);
    this.capLight.position.set(0, HEIGHT + 0.12, 0);
    this.pivot.add(this.capLight);
    this.buildFaces();
    this.buildBasePlate();
    this.buildGround();

    this.scene.add(this.pivot);

    this.bindPointer();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // --- 組み立て ---------------------------------------------------------

  private buildLights(): void {
    this.scene.add(new AmbientLight(0xb0a89c, 1.75));

    const key = new DirectionalLight(0xffe0b4, 2.4);
    key.position.set(1.5, 2.4, 3.6);
    this.scene.add(key);

    const rim = new DirectionalLight(0xcfd6e4, 0.22);
    rim.position.set(-3, 1.2, -2.4);
    this.scene.add(rim);

    const fill = new DirectionalLight(0xffb066, 0.55);
    fill.position.set(-1.5, -1.2, 2);
    this.scene.add(fill);
  }

  /**
   * 側面を 1 枚ずつ作る。三角形 1 枚ごとに絵を貼るので、
   * 面ごとに違う意匠を彫り込める。
   */
  private buildFaces(): void {
    for (let i = 0; i < FACE_COUNT; i += 1) {
      const art = buildFaceArt(i);

      const colorTex = new CanvasTexture(art.color);
      colorTex.colorSpace = SRGBColorSpace;
      colorTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const bumpTex = new CanvasTexture(art.bump);
      const glowTex = new CanvasTexture(art.glow);
      glowTex.colorSpace = SRGBColorSpace;

      const geo = new BufferGeometry();
      // 手前を向いた面を作り、あとで pivot ごと回す
      const a = -HALF;
      const b = HALF;
      const positions = new Float32Array([
        a, 0, HALF,
        b, 0, HALF,
        0, HEIGHT, 0,
      ]);
      const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
      geo.setAttribute('position', new BufferAttribute(positions, 3));
      geo.setAttribute('uv', new BufferAttribute(uvs, 2));
      geo.computeVertexNormals();

      const mat = new MeshStandardMaterial({
        map: colorTex,
        bumpMap: bumpTex,
        bumpScale: 0.6,
        roughness: 0.82,
        metalness: 0,
      });

      const mesh = new Mesh(geo, mat);
      mesh.rotation.y = i * STEP;
      mesh.userData.index = i;
      this.pivot.add(mesh);
      this.faces.push(mesh);

      // 光る層。彫りの部分だけを重ねて発光させる。
      // 加算で重ねること。通常合成だと、この絵の大半を占める黒が
      // そのまま面にかぶさって全体が暗く沈む。
      const glowMat = new MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        blending: AdditiveBlending,
        opacity: 0,
        depthWrite: false,
      });
      const glowMesh = new Mesh(geo.clone(), glowMat);
      glowMesh.rotation.y = i * STEP;
      glowMesh.scale.setScalar(1.004);
      this.pivot.add(glowMesh);
      this.glowMats.push(glowMat);
    }
  }

  /**
   * 頂点の冠石。
   * 実機はスモークがかった透明な小ピラミッドが四角い台座に載り、
   * 内側からアンバーに光る。板を 1 枚立てるのではなく、
   * 台座・外殻・発光する芯の 3 つで組む。
   */
  private buildCapstone(): void {
    const collarY = HEIGHT - 0.1;
    const capBase = 0.2;
    const capH = 0.24;

    // 台座。頂点の少し下に挟む平らな襟
    const collar = new Mesh(
      new BoxGeometry(capBase * 1.25, 0.05, capBase * 1.25),
      new MeshStandardMaterial({ color: new Color(0xb07c38), roughness: 0.8 }),
    );
    collar.position.y = collarY;
    this.pivot.add(collar);

    const capGeo = (half: number, h: number, y0: number) => {
      const geo = new BufferGeometry();
      const verts: number[] = [];
      const corners = [
        [-half, y0, half], [half, y0, half], [half, y0, -half], [-half, y0, -half],
      ];
      for (let i = 0; i < 4; i += 1) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        verts.push(a[0], a[1], a[2], b[0], b[1], b[2], 0, y0 + h, 0);
      }
      geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
      geo.computeVertexNormals();
      return geo;
    };

    // 内側の芯。ここが光る
    const core = new Mesh(
      capGeo(capBase * 0.42, capH * 0.7, collarY + 0.03),
      new MeshBasicMaterial({ color: new Color(0xffb066) }),
    );
    this.pivot.add(core);

    // 外殻。スモークの樹脂
    const shell = new Mesh(
      capGeo(capBase / 2, capH, collarY + 0.02),
      new MeshStandardMaterial({
        color: new Color(0xd8c8b0),
        transparent: true,
        opacity: 0.48,
        roughness: 0.18,
        metalness: 0.1,
      }),
    );
    this.pivot.add(shell);

    this.capCore = core;
    this.pivot.add(shell);
  }

  /** 底の黒い台座。実機はここに載っている */
  private buildBasePlate(): void {
    const plate = new Mesh(
      new BoxGeometry(HALF * 2.12, 0.09, HALF * 2.12),
      new MeshStandardMaterial({ color: new Color(0x141414), roughness: 0.55 }),
    );
    plate.position.y = -0.045;
    this.pivot.add(plate);
  }

  /** 足元の影。板に円のぼかしを描いて敷く */
  private buildGround(): void {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const ctx = cv.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new CanvasTexture(cv);
    const mesh = new Mesh(
      new PlaneGeometry(3.6, 3.6),
      new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.01;
    this.scene.add(mesh);
  }

  // --- 操作 -------------------------------------------------------------

  private bindPointer(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.interactive) return;
    this.dragging = true;
    this.pointerMoved = false;
    this.lastX = e.clientX;
    this.lastMoveAt = performance.now();
    this.downAt = performance.now();
    this.target = null;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.el.classList.add('is-dragging');
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const now = performance.now();
    const dx = e.clientX - this.lastX;
    if (Math.abs(dx) > 2) this.pointerMoved = true;
    const dt = Math.max((now - this.lastMoveAt) / 1000, 1 / 240);

    // 画面の幅いっぱいの横移動でおよそ一周ぶん回る
    const perPixel = (Math.PI * 2) / Math.max(this.el.clientWidth, 240) * 1.15;
    this.angle += dx * perPixel;
    this.spin = (dx * perPixel) / dt;

    this.lastX = e.clientX;
    this.lastMoveAt = now;
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    }
    this.el.classList.remove('is-dragging');

    // 動かさずに離したら、正面の面を選んだものとみなす
    if (!this.pointerMoved && performance.now() - this.downAt < 400) {
      this.spin = 0;
      this.target = this.current;
      this.opts.onPick?.(this.current);
      return;
    }

    // 手を離してすぐ止まっていたら、そのまま吸い付かせる
    if (performance.now() - this.lastMoveAt > 90) this.spin = 0;
    this.spin = Math.max(Math.min(this.spin, MAX_FLING), -MAX_FLING);
  };

  // --- 外から動かす -----------------------------------------------------

  /** 指で回せるかどうか */
  setInteractive(on: boolean): void {
    this.interactive = on;
    this.el.classList.toggle('is-locked', !on);
    if (!on) this.dragging = false;
  }

  /** いま正面にある面 */
  getFace(): number {
    return this.current;
  }

  /**
   * 指定の面まで回す。勢いをつけて回し、行き過ぎてから戻る。
   * アドベンチャーモードで次の試練へ送るときに使う。
   */
  spinTo(index: number, extraTurns = 1): void {
    const from = this.angle;
    // 面 index を正面に持ってくる角度のうち、いまより先にあるもの
    let to = -index * STEP;
    while (to > from - 0.001) to -= Math.PI * 2;
    to -= extraTurns * Math.PI * 2;
    // 勢いだけ与えて、あとは慣性と吸い付きに任せる。
    // 減速で届かない分は吸い付きが引き取るので、面は必ず合う。
    this.target = null;
    const push = (to - from) * 1.5;
    this.spin = Math.min(push, -7);
    this.pendingTarget = index;
  }

  private pendingTarget: number | null = null;

  /** カメラの引き具合。1 が標準 */
  setZoom(z: number): void {
    this.zoomTarget = z;
  }

  /**
   * カメラの構図をまとめて指定する。
   * ease は追従の速さで、小さいほどゆっくり動く。
   */
  setShot(opts: { zoom?: number; lift?: number; ease?: number }): void {
    if (opts.zoom !== undefined) this.zoomTarget = opts.zoom;
    if (opts.lift !== undefined) this.liftTarget = opts.lift;
    if (opts.ease !== undefined) this.camEase = opts.ease;
  }

  /** 構図を即座に合わせる。演出の開始時に使う */
  snapShot(opts: { zoom: number; lift: number }): void {
    this.zoom = this.zoomTarget = opts.zoom;
    this.lift = this.liftTarget = opts.lift;
  }

  /** 選択の演出を出すかどうか */
  setPicked(on: boolean): void {
    this.pickTarget = on ? 1 : 0;
  }

  /** その面を正面にして即座に据える */
  snapTo(index: number): void {
    this.angle = -index * STEP;
    this.spin = 0;
    this.target = index;
    this.current = index;
  }

  // --- 毎フレーム -------------------------------------------------------

  private resize = (): void => {
    const w = this.el.clientWidth || 320;
    const h = this.el.clientHeight || 320;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private faceFromAngle(a: number): number {
    const idx = Math.round(-a / STEP) % FACE_COUNT;
    return (idx + FACE_COUNT) % FACE_COUNT;
  }

  private loop = (t: number): void => {
    if (this.disposed) return;
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;

    if (!this.dragging) {
      // 慣性
      this.angle += this.spin * dt;
      this.spin *= Math.pow(SPIN_DAMP, dt * 60);

      // 十分に遅くなったら目盛りへ吸い付く
      if (Math.abs(this.spin) < SNAP_ENTER) {
        if (this.target === null) {
          this.target = this.pendingTarget ?? this.faceFromAngle(this.angle);
          this.pendingTarget = null;
        }
        const goal = Math.round((this.angle + this.target * STEP) / (Math.PI * 2)) * (Math.PI * 2)
          - this.target * STEP;
        const diff = goal - this.angle;
        this.angle += diff * Math.min(SNAP_PULL * dt, 1);
        this.spin *= 0.8;
        if (Math.abs(diff) < 0.002 && Math.abs(this.spin) < 0.05) {
          this.angle = goal;
          this.spin = 0;
        }
      }
    }

    const face = this.faceFromAngle(this.angle);
    if (face !== this.current) {
      this.current = face;
      this.opts.onFaceChange?.(face);
    }

    this.pivot.rotation.y = this.angle;

    // ゆっくり上下に揺らして、置物らしさを出す
    this.pivot.position.y = Math.sin(t / 1400) * 0.02;

    // カメラの寄り引きと高さ
    const k = Math.min(dt * this.camEase, 1);
    this.zoom += (this.zoomTarget - this.zoom) * k;
    this.lift += (this.liftTarget - this.lift) * k;
    const dist = 3.5 * this.zoom;
    this.camera.position.set(0, 1.5 * this.lift + 0.35, dist);
    this.camera.lookAt(0, HEIGHT * 0.42, 0);

    // 選択の演出。正面の面だけ彫りが灯り、冠石が強く光る
    this.pick += (this.pickTarget - this.pick) * Math.min(dt * 4, 1);
    for (let i = 0; i < this.glowMats.length; i += 1) {
      const front = i === this.current ? 1 : 0;
      const pulse = 0.88 + Math.sin(t / 620) * 0.12;
      this.glowMats[i].opacity = this.pick * front * pulse * 0.42;
    }
    const coreMat = this.capCore.material as MeshBasicMaterial;
    const heat = 0.55 + this.pick * 0.45;
    coreMat.color.setRGB(1, 0.62 + this.pick * 0.22, 0.36 + this.pick * 0.3).multiplyScalar(heat);
    this.capLight.intensity = this.pick * 9;

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  /**
   * 止まって面が定まるまで待つ。
   * 何かの拍子に止まらなくても、待ち時間の上限で必ず返す。
   * ここで止まると先へ進めなくなるため、待ち続けない作りにしている。
   */
  waitSettled(maxWaitMs = 4000): Promise<number> {
    return new Promise((resolve) => {
      const deadline = performance.now() + maxWaitMs;
      const check = () => {
        if (this.disposed) {
          resolve(this.current);
          return;
        }
        const settled =
          !this.dragging && Math.abs(this.spin) < 0.05 && this.target !== null;
        if (settled || performance.now() > deadline) {
          if (!settled) this.snapTo(this.pendingTarget ?? this.current);
          this.opts.onSettle?.(this.current);
          resolve(this.current);
          return;
        }
        window.setTimeout(check, 60);
      };
      check();
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onDown);
    dom.removeEventListener('pointermove', this.onMove);
    dom.removeEventListener('pointerup', this.onUp);
    dom.removeEventListener('pointercancel', this.onUp);
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) (mat as MeshStandardMaterial).dispose();
    });
    this.renderer.dispose();
    this.el.remove();
  }
}
