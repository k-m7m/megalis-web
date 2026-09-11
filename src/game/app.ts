/**
 * 電脳迷宮メガリス Web版 - ゲーム全体の進行管理
 *
 * タイトル → モード選択 → （難易度選択） → ステージ進行 → 結果 という
 * 画面遷移と、ライフ・BGM状態などの全体状態をここで束ねる。
 * 各ステージの中身（判定ロジックや描画）は game/stage*.ts に閉じている。
 */

import { AudioEngine } from './audio';
import { STAGES } from './stages';
import { DIFFICULTY_LABEL, type Difficulty, type Mode, type StageHost, type StageInstance, type StageMeta } from './types';
import { el } from './util';

/**
 * 3D ピラミッドは three.js を伴うため、初回表示の足を引っぱらないよう
 * 必要になったときに読み込む。型だけは先に借りておく。
 */
type PyramidModule = typeof import('./pyramid');
type Pyramid = InstanceType<PyramidModule['PyramidView']>;

const MAX_LIVES = 3;
const MUTE_KEY = 'megalis:muted';

export class MegalisApp {
  private root: HTMLElement;
  private audio = new AudioEngine();
  private muted = false;
  private currentStage: StageInstance | null = null;
  private pyramid: Pyramid | null = null;
  private pyramidModule: Promise<PyramidModule> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.audio.setMuted(this.muted);
    this.showTitle();
  }

  private clear(): void {
    this.currentStage?.dispose();
    this.currentStage = null;
    this.pyramid?.dispose();
    this.pyramid = null;
    this.root.innerHTML = '';
  }

  /** 3D ピラミッドの読み込み。二度目からは同じ約束を返す */
  private loadPyramid(): Promise<PyramidModule> {
    if (!this.pyramidModule) this.pyramidModule = import('./pyramid');
    return this.pyramidModule;
  }

  private unlockAudioOnFirstInput(): void {
    const handler = () => {
      this.audio.unlock();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
  }

  private muteButton(): HTMLElement {
    const btn = el('button', 'mg-mute-btn');
    btn.type = 'button';
    const render = () => {
      btn.textContent = this.muted ? '🔇' : '🔊';
      btn.setAttribute('aria-label', this.muted ? 'ミュート解除' : 'ミュートにする');
    };
    render();
    btn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
      render();
    });
    return btn;
  }

  // ------------------------------------------------------------------
  // タイトル画面
  // ------------------------------------------------------------------
  private showTitle(): void {
    this.clear();
    this.unlockAudioOnFirstInput();

    const view = el('div', 'mg-view mg-title-view');
    view.innerHTML = `
      <div class="mg-pyramid" aria-hidden="true">
        <div class="mg-pyramid-face mg-pyramid-face--left"></div>
        <div class="mg-pyramid-face mg-pyramid-face--right"></div>
        <div class="mg-pyramid-glow"></div>
      </div>
      <p class="mg-eyebrow">非公式リメイク・ファンメイド</p>
      <h1 class="mg-title">電脳迷宮<br /><span>メガリス</span></h1>
      <p class="mg-subtitle">伝説の秘宝をめぐる冒険 〜待ち受ける4つの罠〜</p>
    `;

    const menu = el('div', 'mg-menu');
    const startBtn = el('button', 'mg-btn mg-btn--primary', 'ゲームをはじめる');
    startBtn.type = 'button';
    startBtn.addEventListener('click', () => {
      this.audio.uiClick();
      this.showModeSelect();
    });
    menu.append(startBtn);
    view.append(menu);
    view.append(this.muteButton());

    const note = el(
      'div',
      'mg-fan-note',
      '本作は2005年にタカラより発売された電子玩具「電脳迷宮メガリス」を、有志が個人の記憶と資料をもとにブラウザ向けに再現したファンメイド作品です。原作の権利は権利者に帰属します。',
    );
    view.append(note);

    this.root.append(view);
  }

  // ------------------------------------------------------------------
  // モード選択
  // ------------------------------------------------------------------
  private showModeSelect(): void {
    this.clear();
    // どちらのモードでもこの先で使うので、ここから読み込みを始めておく
    void this.loadPyramid();
    const view = el('div', 'mg-view mg-select-view');
    view.innerHTML = `<h2 class="mg-view-title">モードを選べ</h2>`;

    const cards = el('div', 'mg-card-list');

    const adventureCard = this.modeCard(
      'アドベンチャーモード',
      '4つの試練を順番に突破し、伝説の秘宝を目指す。',
      () => this.showDifficultySelect('adventure'),
    );
    const freeCard = this.modeCard(
      'フリーモード',
      '好きな試練をひとつだけ選んで練習できる。',
      () => this.showStageSelect(),
    );

    cards.append(adventureCard, freeCard);
    view.append(cards);

    const back = this.backButton(() => this.showTitle());
    view.append(back);
    this.root.append(view);
  }

  private modeCard(title: string, desc: string, onSelect: () => void): HTMLElement {
    const card = el('button', 'mg-card');
    card.type = 'button';
    card.innerHTML = `<span class="mg-card-title">${title}</span><span class="mg-card-desc">${desc}</span>`;
    card.addEventListener('click', () => {
      this.audio.uiClick();
      onSelect();
    });
    return card;
  }

  private backButton(onBack: () => void): HTMLElement {
    const btn = el('button', 'mg-btn mg-btn--ghost', '← もどる');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      this.audio.uiClick();
      onBack();
    });
    return btn;
  }

  // ------------------------------------------------------------------
  // 難易度選択（アドベンチャーモード）
  // ------------------------------------------------------------------
  private showDifficultySelect(mode: Mode, singleStage?: StageMeta): void {
    this.clear();
    const view = el('div', 'mg-view mg-select-view');
    view.innerHTML = `<h2 class="mg-view-title">難易度を選べ</h2>`;

    const cards = el('div', 'mg-card-list');
    const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
    for (const d of diffs) {
      const card = this.modeCard(DIFFICULTY_LABEL[d], this.difficultyDesc(d), () => {
        if (mode === 'adventure') {
          this.startAdventure(d);
        } else if (singleStage) {
          this.startFreeStage(singleStage, d);
        }
      });
      cards.append(card);
    }
    view.append(cards);

    view.append(
      this.backButton(() => (mode === 'adventure' ? this.showModeSelect() : this.showStageSelect())),
    );
    this.root.append(view);
  }

  private difficultyDesc(d: Difficulty): string {
    switch (d) {
      case 'easy':
        return '覚える量が少なく、時間にも余裕がある。';
      case 'normal':
        return '標準的な歯ごたえ。まずはここから。';
      case 'hard':
        return '覚える量が多く、時間も短い。腕に自信があれば。';
    }
  }

  // ------------------------------------------------------------------
  // フリーモード：ステージ選択
  // ------------------------------------------------------------------
  private async showStageSelect(): Promise<void> {
    this.clear();
    const view = el('div', 'mg-view mg-select-view mg-select-view--pyramid');
    view.innerHTML = `<h2 class="mg-view-title">挑む試練を選べ</h2>`;
    const loading = el('p', 'mg-hint-line', 'ピラミッドを組み上げている…');
    view.append(loading);
    this.root.append(view);

    const { PyramidView } = await this.loadPyramid();
    // 読み込んでいる間に別の画面へ移っていたら何もしない
    if (!view.isConnected) return;
    loading.remove();

    const plaque = el('div', 'mg-plaque');
    const enterBtn = el('button', 'mg-btn mg-btn--primary', 'この試練に挑む');
    enterBtn.type = 'button';

    const renderPlaque = (index: number) => {
      const stage = STAGES[index];
      plaque.innerHTML = `
        <span class="mg-plaque-eyebrow">第${stage.no}の試練 ・ ${stage.kind}</span>
        <span class="mg-plaque-title">${stage.title}</span>
        <span class="mg-plaque-desc">${stage.brief}</span>`;
    };

    const pyramid = new PyramidView({
      onFaceChange: (index) => {
        renderPlaque(index);
        this.audio.dialClick();
      },
      onPick: () => enter(),
    });
    this.pyramid = pyramid;

    const enter = () => {
      if (!pyramid) return;
      pyramid.setInteractive(false);
      pyramid.setPicked(true);
      this.audio.stageClear();
      const stage = STAGES[pyramid.getFace()];
      pyramid.setZoom(0.62);
      view.classList.add('mg-select-view--entering');
      window.setTimeout(() => this.showDifficultySelect('free', stage), 900);
    };
    enterBtn.addEventListener('click', enter);

    renderPlaque(pyramid.getFace());
    pyramid.setPicked(true);

    view.append(pyramid.el, plaque, enterBtn);
    view.append(
      el('p', 'mg-hint-line', 'ピラミッドを指で回して、挑む面を正面に向けろ'),
    );
    view.append(this.backButton(() => this.showModeSelect()));
  }

  // ------------------------------------------------------------------
  // ステージ説明（共通）
  // ------------------------------------------------------------------
  private showStageIntro(
    stage: StageMeta,
    difficulty: Difficulty,
    onStart: () => void,
  ): void {
    this.clear();
    const view = el('div', 'mg-view mg-intro-view');
    view.innerHTML = `
      <p class="mg-eyebrow">第${stage.no}の試練 ・ ${DIFFICULTY_LABEL[difficulty]}</p>
      <h2 class="mg-view-title">${stage.title}</h2>
      <p class="mg-intro-kind">${stage.kind}</p>
      <p class="mg-intro-brief">${stage.brief}</p>
      <ul class="mg-intro-howto">
        ${stage.howto.map((line) => `<li>${line}</li>`).join('')}
      </ul>
    `;
    const startBtn = el('button', 'mg-btn mg-btn--primary', '挑戦する');
    startBtn.type = 'button';
    startBtn.addEventListener('click', () => {
      this.audio.uiClick();
      onStart();
    });
    view.append(startBtn);
    this.root.append(view);
  }

  // ------------------------------------------------------------------
  // フリーモード実行
  // ------------------------------------------------------------------
  private startFreeStage(stage: StageMeta, difficulty: Difficulty): void {
    this.showStageIntro(stage, difficulty, () => {
      void this.playSingle(stage, difficulty).then((cleared) => {
        this.showFreeResult(stage, difficulty, cleared);
      });
    });
  }

  private showFreeResult(stage: StageMeta, difficulty: Difficulty, cleared: boolean): void {
    this.clear();
    const view = el('div', 'mg-view mg-result-view');
    view.innerHTML = cleared
      ? `<h2 class="mg-view-title mg-result-clear">突破！</h2><p>「${stage.title}」をクリアした。</p>`
      : `<h2 class="mg-view-title mg-result-fail">失敗…</h2><p>「${stage.title}」に阻まれた。</p>`;

    const retry = el('button', 'mg-btn mg-btn--primary', 'もう一度挑む');
    retry.type = 'button';
    retry.addEventListener('click', () => {
      this.audio.uiClick();
      this.startFreeStage(stage, difficulty);
    });
    const back = el('button', 'mg-btn mg-btn--ghost', '試練選択へ');
    back.type = 'button';
    back.addEventListener('click', () => {
      this.audio.uiClick();
      this.showStageSelect();
    });
    view.append(retry, back);
    this.root.append(view);
  }

  /** ライフ制限なしで 1 ステージだけ動かす（フリーモード用） */
  private playSingle(stage: StageMeta, difficulty: Difficulty): Promise<boolean> {
    this.clear();
    const view = el('div', 'mg-view mg-play-view');
    const hud = this.buildHud(stage, difficulty, MAX_LIVES);
    const stageRoot = el('div', 'mg-stage-root');
    view.append(hud.el, stageRoot);
    this.root.append(view);

    let lives = MAX_LIVES;
    const host = this.buildHost(difficulty, hud, () => lives, (n) => {
      lives = n;
    });

    const instance = stage.factory(stageRoot, host);
    this.currentStage = instance;
    return instance.run();
  }

  // ------------------------------------------------------------------
  // アドベンチャーモード実行
  // ------------------------------------------------------------------
  private async startAdventure(difficulty: Difficulty): Promise<void> {
    let lives = MAX_LIVES;

    for (let i = 0; i < STAGES.length; i += 1) {
      const stage = STAGES[i];

      // どの試練に入るときも、必ずピラミッドが回って面を選ぶところを見せる。
      // 1 つ目も同じ流れにすることで、始めた直後から演出が出る。
      await this.playSelectionMovie(i === 0 ? null : STAGES[i - 1], stage);

      const cleared = await new Promise<boolean>((resolve) => {
        this.clear();
        const view = el('div', 'mg-view mg-play-view');
        const hud = this.buildHud(stage, difficulty, lives, i + 1, STAGES.length);
        const stageRoot = el('div', 'mg-stage-root');
        view.append(hud.el, stageRoot);
        this.root.append(view);

        const host = this.buildHost(
          difficulty,
          hud,
          () => lives,
          (n) => {
            lives = n;
          },
        );
        const instance = stage.factory(stageRoot, host);
        this.currentStage = instance;
        void instance.run().then(resolve);
      });

      if (!cleared) {
        this.audio.gameOver();
        this.showAdventureEnd(false, i + 1, difficulty);
        return;
      }
      this.audio.stageClear();
    }

    this.audio.fanfare();
    this.showAdventureEnd(true, STAGES.length, difficulty);
  }

  /**
   * 試練に入る前のひとつながりの演出。
   *
   *   1. 直前の面に寄った状態から画面が引いて、ピラミッド全体が現れる
   *   2. 勢いよく回り、慣性で次の面が正面に来る
   *   3. その面の仕掛けに光が灯る
   *   4. 面に寄っていき、そのまま試練へ入る
   *
   * from が null のときは最初の試練なので、引きの絵から始める。
   */
  private async playSelectionMovie(
    from: StageMeta | null,
    to: StageMeta,
  ): Promise<void> {
    this.clear();
    const { PyramidView } = await this.loadPyramid();

    const view = el('div', 'mg-view mg-movie-view');
    const caption = el('div', 'mg-movie-caption');
    caption.innerHTML = `
      <span class="mg-movie-line1"></span>
      <span class="mg-movie-line2"></span>`;
    const line1 = caption.querySelector('.mg-movie-line1') as HTMLElement;
    const line2 = caption.querySelector('.mg-movie-line2') as HTMLElement;

    const pyramid = new PyramidView();
    this.pyramid = pyramid;
    pyramid.setInteractive(false);
    pyramid.snapTo(from ? from.no - 1 : to.no - 1);

    const skip = el('button', 'mg-btn mg-btn--ghost', '演出を飛ばす');
    skip.type = 'button';
    view.append(pyramid.el, caption, skip);
    this.root.append(view);

    if (from) {
      line1.textContent = `「${from.title}」を突破`;
      pyramid.snapShot({ zoom: 0.55, lift: 0.55 });
      pyramid.setPicked(true);
    } else {
      line1.textContent = '迷宮が目を覚ます';
      pyramid.snapShot({ zoom: 1.9, lift: 1.8 });
      pyramid.setPicked(false);
    }

    return new Promise<void>((resolve) => {
      const timers: number[] = [];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        for (const t of timers) window.clearTimeout(t);
        resolve();
      };
      const at = (ms: number, fn: () => void) => {
        timers.push(window.setTimeout(fn, ms));
      };

      // 1. 引いて全体を見せる
      at(from ? 500 : 200, () => {
        pyramid.setPicked(false);
        pyramid.setShot({ zoom: 1.35, lift: 1.25, ease: 2.2 });
        view.classList.add('is-wide');
      });

      // 2. 回す。目的の面へ勢いよく送る
      at(from ? 1400 : 1100, () => {
        this.audio.launch();
        line2.textContent = '石が動く';
        pyramid.spinTo(to.no - 1, from ? 1 : 0);
      });

      // 3. 止まったら灯す
      at(from ? 1550 : 1250, () => {
        void pyramid.waitSettled().then(() => {
          if (done) return;
          line1.textContent = `第${to.no}の試練`;
          line2.textContent = to.title;
          pyramid.setPicked(true);
          this.audio.stoneGlow();
          view.classList.add('is-revealed');

          // 4. 面に寄って、そのまま試練へ
          at(900, () => {
            pyramid.setShot({ zoom: 0.42, lift: 0.5, ease: 1.6 });
            this.audio.correct();
            view.classList.add('is-diving');
          });
          at(2100, finish);
        });
      });

      skip.addEventListener('click', () => {
        this.audio.uiClick();
        finish();
      });

      // 演出のどこかで止まっても冒険が止まらないよう、全体にも上限を置く
      at(11000, finish);
    });
  }

  private showAdventureEnd(cleared: boolean, reachedStage: number, difficulty: Difficulty): void {
    this.clear();
    const view = el('div', 'mg-view mg-result-view mg-result-view--final');
    if (cleared) {
      view.innerHTML = `
        <div class="mg-treasure" aria-hidden="true"></div>
        <h2 class="mg-view-title mg-result-clear">秘宝を手に入れた</h2>
        <p>4つの試練をすべて突破し、電脳迷宮メガリスの最奥にたどり着いた。</p>
        <p class="mg-result-diff">難易度：${DIFFICULTY_LABEL[difficulty]}</p>
      `;
    } else {
      view.innerHTML = `
        <h2 class="mg-view-title mg-result-fail">迷宮に飲み込まれた</h2>
        <p>第${reachedStage}の試練で力尽きた。ライフが尽きると挑戦は終わる。</p>
        <p class="mg-result-diff">難易度：${DIFFICULTY_LABEL[difficulty]}</p>
      `;
    }

    const retry = el('button', 'mg-btn mg-btn--primary', 'もう一度挑む');
    retry.type = 'button';
    retry.addEventListener('click', () => {
      this.audio.uiClick();
      this.startAdventure(difficulty);
    });
    const toTitle = el('button', 'mg-btn mg-btn--ghost', 'タイトルへ');
    toTitle.type = 'button';
    toTitle.addEventListener('click', () => {
      this.audio.uiClick();
      this.showTitle();
    });
    view.append(retry, toTitle);
    this.root.append(view);
  }

  // ------------------------------------------------------------------
  // HUD / Host（ステージ側に渡す共通インターフェース）
  // ------------------------------------------------------------------
  private buildHud(
    stage: StageMeta,
    difficulty: Difficulty,
    lives: number,
    stageNo?: number,
    stageTotal?: number,
  ) {
    const hudEl = el('div', 'mg-hud');
    const progressText =
      stageNo && stageTotal ? `第${stageNo}の試練 / 全${stageTotal}` : `フリーモード`;
    hudEl.innerHTML = `
      <div class="mg-hud-row mg-hud-row--top">
        <span class="mg-hud-progress">${progressText}</span>
        <span class="mg-hud-diff">${DIFFICULTY_LABEL[difficulty]}</span>
      </div>
      <div class="mg-hud-row mg-hud-row--mid">
        <h3 class="mg-hud-stage-title">${stage.title}</h3>
        <div class="mg-hud-lives"></div>
      </div>
      <p class="mg-hud-status">準備はいいか。</p>
      <p class="mg-hud-meter"></p>
    `;

    const livesEl = hudEl.querySelector('.mg-hud-lives') as HTMLElement;
    const statusEl = hudEl.querySelector('.mg-hud-status') as HTMLElement;
    const meterEl = hudEl.querySelector('.mg-hud-meter') as HTMLElement;

    const renderLives = (n: number) => {
      livesEl.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) =>
        i < n ? '<span class="mg-life is-on">◆</span>' : '<span class="mg-life">◇</span>',
      ).join('');
    };
    renderLives(lives);

    return {
      el: hudEl,
      setStatus: (text: string) => {
        statusEl.textContent = text;
      },
      setMeter: (text: string) => {
        meterEl.textContent = text;
      },
      renderLives,
    };
  }

  private buildHost(
    difficulty: Difficulty,
    hud: ReturnType<MegalisApp['buildHud']>,
    getLives: () => number,
    setLives: (n: number) => void,
  ): StageHost {
    return {
      difficulty,
      audio: this.audio,
      setStatus: (text: string) => hud.setStatus(text),
      setMeter: (text: string) => hud.setMeter(text),
      lives: () => getLives(),
      miss: (_reason: string) => {
        const next = Math.max(0, getLives() - 1);
        setLives(next);
        hud.renderLives(next);
        return next;
      },
      flash: (kind: 'good' | 'bad') => {
        hud.el.classList.remove('mg-flash-good', 'mg-flash-bad');
        // 強制リフロー: 連続で同じクラスを付け直しても再生されるように
        void hud.el.offsetWidth;
        hud.el.classList.add(kind === 'good' ? 'mg-flash-good' : 'mg-flash-bad');
      },
    };
  }
}
