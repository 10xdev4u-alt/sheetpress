#!/usr/bin/env node
// 把演示帧合成为 docs/demo/demo.gif 与 demo.mp4（需要 ffmpeg）。
// 用法：node docs/demo/make-gif.mjs <帧目录>
// 帧来源：docs/demo/terminal.html?step=1|2|3 与 examples/tcp.en.md 渲染页，1280×800 截图。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const FRAMES = [
  ['f1-terminal.png', 1.6], ['f2-terminal.png', 2.0], ['f3-terminal.png', 2.8],
  ['f4-page.png', 2.6], ['f5-page-scroll.png', 2.2], ['f6-shadcn.png', 2.0], ['f7-dark.png', 2.8],
];
const FADE = 0.4;
const dir = process.argv[2];
if (!dir) {
  process.stderr.write('用法：node docs/demo/make-gif.mjs <帧目录>\n');
  process.exit(2);
}
const out = fileURLToPath(new URL('.', import.meta.url));

const inputs = FRAMES.flatMap(([f, d]) => ['-loop', '1', '-t', String(d), '-i', join(dir, f)]);
let chain = '[0:v]format=yuv420p,setsar=1[v0]';
let offset = 0;
FRAMES.slice(1).forEach((_, i) => {
  offset += FRAMES[i][1] - FADE;
  chain += `;[${i + 1}:v]format=yuv420p,setsar=1[s${i + 1}];[v${i}][s${i + 1}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[v${i + 1}]`;
});
const last = `[v${FRAMES.length - 1}]`;

const run = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run([...inputs, '-filter_complex', `${chain};${last}fps=30,scale=1280:-2[out]`, '-map', '[out]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, 'demo.mp4')]);
run([...inputs, '-filter_complex',
  `${chain};${last}fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[out]`,
  '-map', '[out]', '-loop', '0', join(out, 'demo.gif')]);
process.stdout.write(`✓ ${join(out, 'demo.mp4')}\n✓ ${join(out, 'demo.gif')}\n`);
