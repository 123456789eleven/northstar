// Shared helpers for Northstar Claude Code hooks. No dependencies. Never throw.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function emit(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch {
    /* ignore */
  }
}

export function safe(fn) {
  try {
    fn();
  } catch {
    /* hooks never throw */
  }
  process.exit(0);
}

export const tmp = (name) => path.join(os.tmpdir(), name);

export function norm(p) {
  return String(p || '').replace(/\\/g, '/');
}
