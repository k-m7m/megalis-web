#!/usr/bin/env node
/**
 * 守護獣の鳴き声を、記憶ゲームで使える形にそろえるスクリプト。
 *
 *   node tools/prepare-sounds.mjs <元音源フォルダ>
 *
 * やること
 *   - 前後の無音を切り落とす（押した瞬間に鳴るようにする）
 *   - 長さを 0.9 秒までに詰める
 *   - 音量をそろえる（1つだけ大きいと、その守護獣だけ覚えやすくなってしまう）
 *   - webm(Opus) に変換して public/sounds/ に出す
 *   - manifest.json を書く
 *
 * 元音源フォルダには、守護獣の番号で始まる名前のファイルを置く。
 * 例: 0-snake.wav, 3-jackal.mp3
 *
 * ffmpeg が必要。入っていなければ https://ffmpeg.org/ から入れること。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const BEASTS = ['snake', 'bat', 'scorpion', 'jackal', 'falcon', 'crocodile'];
const MAX_DURATION = 0.9;
/** そろえる音量 (LUFS)。小さめにして耳に痛くないようにする */
const TARGET_LOUDNESS = -18;

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('使い方: node tools/prepare-sounds.mjs <元音源フォルダ>');
  process.exit(1);
}
if (!existsSync(srcDir)) {
  console.error(`フォルダが見つからない: ${srcDir}`);
  process.exit(1);
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('ffmpeg が見つからない。先に導入すること。');
  process.exit(1);
}

const outDir = resolve('public/sounds');
mkdirSync(outDir, { recursive: true });

const manifest = {};

for (const file of readdirSync(srcDir)) {
  const ext = extname(file).toLowerCase();
  if (!['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.webm'].includes(ext)) continue;

  const id = Number(basename(file)[0]);
  if (!Number.isInteger(id) || id < 0 || id >= BEASTS.length) {
    console.warn(`番号で始まっていないので飛ばす: ${file}`);
    continue;
  }

  const outName = `${BEASTS[id]}.webm`;
  const outPath = join(outDir, outName);

  // silenceremove で前後の無音を落とし、loudnorm で音量をそろえる
  const filters = [
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02',
    'areverse',
    `loudnorm=I=${TARGET_LOUDNESS}:TP=-1.5:LRA=11`,
    'afade=t=out:st=' + (MAX_DURATION - 0.06).toFixed(2) + ':d=0.06',
  ].join(',');

  execFileSync(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', join(srcDir, file),
      '-af', filters,
      '-t', String(MAX_DURATION),
      '-ac', '1',
      '-ar', '48000',
      '-c:a', 'libopus', '-b:a', '64k',
      outPath,
    ],
    { stdio: 'inherit' },
  );

  manifest[String(id)] = outName;
  console.log(`${file} -> ${outName}`);
}

if (Object.keys(manifest).length === 0) {
  console.error('変換できたファイルが無い。ファイル名が番号で始まっているか確認すること。');
  process.exit(1);
}

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nmanifest.json を書いた（${Object.keys(manifest).length} 件）`);
console.log('出典とライセンスを public/sounds/credits.md に残すこと。');
