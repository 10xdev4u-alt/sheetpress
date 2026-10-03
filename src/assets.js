// Static assets needed at runtime live here. They are read from disk during development; when bundling (scripts/build.mjs) the whole module is replaced with inline strings,
// The bundled skills/sheetpress/scripts/sp.mjs therefore has no runtime dependency on external files.
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

export const VERSION = JSON.parse(read('../package.json')).version;
export const BASE_CSS = read('./themes/base.css');
export const RUNTIME_JS = read('./runtime/page.js');
