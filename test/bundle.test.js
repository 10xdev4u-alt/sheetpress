import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// Simulate `npx skills add`: copy only the skill directory to an isolated location and confirm the bundle has no dependency on any other repo file.
test('bundle: skill dir still renders when copied out standalone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'am-bundle-'));
  try {
    cpSync(join(ROOT, 'skills/sheetpress'), join(dir, 'sheetpress'), { recursive: true });
    const cli = join(dir, 'sheetpress/scripts/sp.mjs');
    const env = { ...process.env, AM_NO_OPEN: '1' };

    const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8', env });
    assert.equal(version.stdout.trim(), PKG.version, 'Bundled version must match package.json (did you forget npm run build?)');

    const out = join(dir, 'out.html');
    const r = spawnSync(process.execPath, [cli, 'render', '-', '-o', out], {
      input: '---\ntitle: 打包测试\n---\n## A\n```flow\nA -> B\n```\n', encoding: 'utf8', env, cwd: dir,
    });
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<h1>打包测试<\/h1>/);
    assert.match(html, /class="am-node /);
    assert.match(html, /--font-mono/, 'CSS is inlined');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
