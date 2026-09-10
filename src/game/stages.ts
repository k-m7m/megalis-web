import { createStage1 } from './stage1';
import { createStage2 } from './stage2';
import { createStage3 } from './stage3';
import { createStage4 } from './stage4';
import type { StageMeta } from './types';

export const STAGES: StageMeta[] = [
  {
    no: 1,
    code: 'GUARDIAN',
    title: '守護獣の叫び',
    kind: '音の記憶ゲーム',
    brief: '6体の守護獣が順番に鳴く。光は出ない。鳴き声だけを頼りに、同じ順で石像に触れろ。',
    howto: [
      '最初に守護獣が 1 体ずつ紹介され、鳴き声を確認できる。',
      '出題が始まると石像は光らない。耳だけで順番を覚える。',
      '正解するたびに 1 体ずつ追加され、覚える数が増えていく。',
    ],
    factory: createStage1,
  },
  {
    no: 2,
    code: 'SERPENT',
    title: '大蛇の回廊',
    kind: 'パワーゲージの見極め',
    brief: '渦巻きの回廊に玉を転がし込み、光っている穴に落とせ。強すぎると最奥の大蛇に飲み込まれる。',
    howto: [
      '左右に往復するゲージを、タップ（クリック / スペースキー）で止めて発射する。',
      'パワーが強いほど玉は奥まで進む。4つの穴それぞれに対応するパワー帯がある。',
      '発射に運の要素はない。同じパワーなら必ず同じ穴に入る。',
      'やさしいでは狙う穴のパワー帯がゲージに表示される。むずかしいでは表示されない。',
    ],
    factory: createStage2,
  },
  {
    no: 3,
    code: 'SEAL',
    title: '封印の扉',
    kind: '光の記憶ゲーム',
    brief: '9枚の石板が順番に光る。位置と順番を覚えて、同じ順になぞれ。',
    howto: [
      '石板が一定の順番で光る。位置と順番の両方を記憶する。',
      '正解するたびに石板の数が 1 枚ずつ増えていく。',
      '規定の長さを再現できれば封印が解ける。',
    ],
    factory: createStage3,
  },
  {
    no: 4,
    code: 'CURSE',
    title: '呪われた谷',
    kind: 'イライラ棒',
    brief: '入り組んだ通路の壁に触れないよう、制限時間内に頂上のゴールまでポインタを運べ。',
    howto: [
      'スタート地点の緑の丸を押さえたまま指（マウス）を離さずに進む。',
      '通路の壁に触れるとブザーが鳴り、少しの間だけ猶予が入る。',
      '制限時間内にゴールの旗まで到達すればクリア。',
    ],
    factory: createStage4,
  },
];
