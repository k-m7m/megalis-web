import type { AudioEngine } from './audio';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Mode = 'adventure' | 'free';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
};

/** ステージ側からゲーム本体へ結果を返すための窓口 */
export interface StageHost {
  readonly difficulty: Difficulty;
  readonly audio: AudioEngine;
  /** 画面上部の指示文を書き換える */
  setStatus(text: string): void;
  /** 進捗メーター（残り玉数、残り時間など）を書き換える */
  setMeter(text: string): void;
  /** ミスを 1 回計上する。戻り値は残りライフ */
  miss(reason: string): number;
  /** 現在の残りライフ */
  lives(): number;
  /** ステージ演出用のフラッシュ */
  flash(kind: 'good' | 'bad'): void;
}

export interface StageInstance {
  /** クリアなら true、ライフ切れなら false で解決する */
  run(): Promise<boolean>;
  /** 画面から取り除くときの後始末 */
  dispose(): void;
}

export type StageFactory = (
  root: HTMLElement,
  host: StageHost,
) => StageInstance;

export interface StageMeta {
  no: number;
  code: string;
  title: string;
  kind: string;
  brief: string;
  howto: string[];
  factory: StageFactory;
}
