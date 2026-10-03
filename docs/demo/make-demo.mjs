#!/usr/bin/env node
// 合成演示视频：docs/demo/demo.mp4（1920×1080，带卡点音乐）与 demo.gif（960 宽，无声）。
// 用法：node docs/demo/make-demo.mjs <帧目录>
// 帧目录里放 frame-0000.jpg … ：用浏览器打开 demo.html（与渲染好的 tcp.html 一起通过 HTTP 提供，
// URL 参数取 timeline.json 的 data），等待 window.ready 后，对 t = i / fps 依次调用 window.render(t) 并截图。
// 依赖：ffmpeg。音乐由 music.mjs 现场合成，卡点取 timeline.json 的 cuts。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const ff = (args) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

const music = join(dir, 'music.wav');
run(process.execPath, [join(here, 'music.mjs'), music, String(tl.total), tl.cuts.join(',')]);

ff(['-framerate', String(tl.fps), '-i', join(dir, 'frame-%04d.jpg'), '-i', music,
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
  '-c:a', 'aac', '-b:a', '160k', '-t', String(tl.total), '-movflags', '+faststart', join(here, 'demo.mp4')]);
ff(['-i', join(here, 'demo.mp4'), '-filter_complex',
  'fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  '-loop', '0', join(here, 'demo.gif')]);
process.stdout.write(`✓ ${join(here, 'demo.mp4')}\n✓ ${join(here, 'demo.gif')}\n`);
