#!/usr/bin/env node
// 合成演示视频：docs/demo/demo.mp4（1920×1080，带卡点音乐）与 demo.gif（960 宽，无声，给 README 用）。
// 用法：node docs/demo/make-demo.mjs <帧目录>
// 帧目录里放 frame-00.png … frame-NN.png，顺序与时长来自 timeline.json；截图方法见 README 的 Development 一节。
// 依赖：ffmpeg。音乐由 music.mjs 现场合成，卡点取 timeline.json 的 cuts。
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const dir = process.argv[2] && resolve(process.argv[2]);
if (!dir) {
  process.stderr.write('用法：node docs/demo/make-demo.mjs <帧目录>\n');
  process.exit(2);
}
const tl = JSON.parse(readFileSync(join(here, 'timeline.json'), 'utf8'));

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const music = join(dir, 'music.wav');
run(process.execPath, [join(here, 'music.mjs'), music, String(tl.total), tl.cuts.join(',')]);

const frame = (i) => join(dir, `frame-${String(i).padStart(2, '0')}.png`);
const list = tl.frames.flatMap((f, i) => {
  const end = tl.frames[i + 1]?.t ?? tl.total;
  return [`file '${frame(i)}'`, `duration ${(end - f.t).toFixed(3)}`];
});
list.push(`file '${frame(tl.frames.length - 1)}'`);
const listFile = join(dir, 'frames.txt');
writeFileSync(listFile, `${list.join('\n')}\n`);

const ff = (args) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-i', music,
  '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p',
  '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-c:a', 'aac', '-b:a', '160k',
  '-t', String(tl.total), '-movflags', '+faststart', join(here, 'demo.mp4')]);
ff(['-i', join(here, 'demo.mp4'), '-filter_complex',
  'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  '-loop', '0', join(here, 'demo.gif')]);
process.stdout.write(`✓ ${join(here, 'demo.mp4')}\n✓ ${join(here, 'demo.gif')}\n`);
