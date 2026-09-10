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

const MAX_LIVES = 3;
const MUTE_KEY = 'megalis:muted';

export class MegalisApp {
  private root: HTMLElement;
  private audio = new AudioEngine();
  private muted = false;
  private currentStage: StageInstance | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.audio.setMuted(this.muted);
    this.showTitle();
  }

  private clear(): void {
    this.currentStage?.dispose();
    this.currentStage = null;
    this.root.innerHTML = '';
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
  private showStageSelect(): void {
    this.clear();
    const view = el('div', 'mg-view mg-select-view');
    view.innerHTML = `<h2 class="mg-view-title">挑む試練を選べ</h2>`;

    const cards = el('div', 'mg-card-list');
    for (const stage of STAGES) {
      const card = el('button', 'mg-card mg-card--stage');
      card.type = 'button';
      card.innerHTML = `
        <span class="mg-card-eyebrow">第${stage.no}の試練 ・ ${stage.kind}</span>
        <span class="mg-card-title">${stage.title}</span>
        <span class="mg-card-desc">${stage.brief}</span>`;
      card.addEventListener('click', () => {
        this.audio.uiClick();
        this.showDifficultySelect('free', stage);
      });
      cards.append(card);
    }
    view.append(cards);
    view.append(this.backButton(() => this.showModeSelect()));
    this.root.append(view);
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
      const cleared = await new Promise<boolean>((resolve) => {
        this.showStageIntro(stage, difficulty, () => {
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
      });

      if (!cleared) {
        this.audio.gameOver();
        this.showAdventureEnd(false, i + 1, difficulty);
        return;
      }
      this.audio.stageClear();
      await this.showStageClearInterstitial(stage, i === STAGES.length - 1);
    }
    this.audio.fanfare();
    this.showAdventureEnd(true, STAGES.length, difficulty);
  }

  private showStageClearInterstitial(stage: StageMeta, isLast: boolean): Promise<void> {
    this.clear();
    const view = el('div', 'mg-view mg-result-view mg-result-view--interstitial');
    view.innerHTML = `
      <h2 class="mg-view-title mg-result-clear">突破！</h2>
      <p>「${stage.title}」を封じていた仕掛けが崩れ落ちた。</p>
    `;
    const nextBtn = el(
      'button',
      'mg-btn mg-btn--primary',
      isLast ? '最奥へ進む' : '次の試練へ',
    );
    nextBtn.type = 'button';
    view.append(nextBtn);
    this.root.append(view);
    return new Promise((resolve) => {
      nextBtn.addEventListener('click', () => {
        this.audio.uiClick();
        resolve();
      });
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
