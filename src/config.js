// User config: ~/.sheetpress/config.json (SHEETPRESS_HOME relocates it; AM_HOME is honored as a legacy fallback).
// Only keys the user explicitly set are stored; reads merge with defaults, and a broken file or
// illegal value always falls back to defaults so config problems never block rendering.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { CHOICES } from './parse.js';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const CONFIG_KEYS = Object.freeze({
  open: { type: 'bool', default: true, label: 'Open the page in a browser after generating' },
  always: { type: 'bool', default: true, label: 'High-frequency mode: attach a page with every conclusion (requires the sheetpress-always plugin)' },
  theme: { type: 'enum', choices: CHOICES.theme, default: 'blueprint', label: 'Default theme' },
  mode: { type: 'enum', choices: CHOICES.mode, default: 'auto', label: 'Default color mode' },
  style: { type: 'enum', choices: CHOICES.style, default: '80', label: 'STE writing-check strictness' },
});

const TRUE = new Set(['on', 'true', 'yes', '1', '开', '开启', '打开']);
const FALSE = new Set(['off', 'false', 'no', '0', '关', '关闭']);

export function amHome(env = process.env) {
  return env.SHEETPRESS_HOME || env.AM_HOME || join(homedir(), '.sheetpress');
}

export function configPath(env = process.env) {
  return join(amHome(env), 'config.json');
}

const defaults = () => Object.fromEntries(Object.entries(CONFIG_KEYS).map(([k, s]) => [k, s.default]));

function coerce(key, raw) {
  const spec = CONFIG_KEYS[key];
  if (!spec) throw new ConfigError(`No such setting "${key}". Available: ${Object.keys(CONFIG_KEYS).join(' | ')}`);
  if (spec.type === 'bool') {
    if (typeof raw === 'boolean') return raw;
    const v = String(raw).trim().toLowerCase();
    if (TRUE.has(v)) return true;
    if (FALSE.has(v)) return false;
    throw new ConfigError(`${key} accepts only on / off`);
  }
  const v = String(raw).trim();
  if (!spec.choices.includes(v)) throw new ConfigError(`Invalid value "${v}" for ${key}, expected: ${spec.choices.join(' | ')}`);
  return v;
}

function readStored(env) {
  const file = configPath(env);
  if (!existsSync(file)) return { stored: {} };
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return { stored: data && typeof data === 'object' && !Array.isArray(data) ? data : {} };
  } catch (e) {
    return { stored: {}, warning: `${file} could not be parsed, using default settings (${e.message})` };
  }
}

export function readConfig(env = process.env) {
  const { stored, warning } = readStored(env);
  const values = defaults();
  for (const [k, v] of Object.entries(stored)) {
    if (!CONFIG_KEYS[k]) continue;
    try {
      values[k] = coerce(k, v);
    } catch {
      // Keep the default for invalid values.
    }
  }
  return { values, stored, warning, path: configPath(env) };
}

function writeStored(stored, env) {
  const file = configPath(env);
  if (!Object.keys(stored).length) {
    rmSync(file, { force: true });
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`);
}

export function setConfig(key, raw, env = process.env) {
  const value = coerce(key, raw);
  const { stored } = readStored(env);
  writeStored({ ...stored, [key]: value }, env);
  return value;
}

export function resetConfig(key, env = process.env) {
  if (key !== undefined && !CONFIG_KEYS[key]) coerce(key, '');
  const { stored } = readStored(env);
  const next = key === undefined ? {} : Object.fromEntries(Object.entries(stored).filter(([k]) => k !== key));
  writeStored(next, env);
}
