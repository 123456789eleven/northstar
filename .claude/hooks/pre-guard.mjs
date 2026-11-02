// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): deny secrets / private paths / .git internals.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInput, emit, safe, norm } from './_lib.mjs';

// Folder names to protect live OUTSIDE the repo so this public file never names them:
// ~/.northstar-tools/private-paths.txt, one folder name per line (# comments allowed), or env NORTHSTAR_PRIVATE_PATHS (comma separated).
function privateFolders() {
  const out = [];
  try {
    const f = path.join(os.homedir(), '.northstar-tools', 'private-paths.txt');
    if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) if (l.trim() && !l.trim().startsWith('#')) out.push(l.trim());
  } catch { /* ignore */ }
  for (const s of String(process.env.NORTHSTAR_PRIVATE_PATHS || '').split(',')) if (s.trim()) out.push(s.trim());
  return out;
}

safe(() => {
  const input = readInput();
  const file = input.tool_input?.file_path || input.tool_input?.notebook_path || input.tool_input?.path;
  if (!file) return;
  const p = norm(file);
  const base = p.split('/').pop() || '';
  let reason = '';
  if (/^\.env(\..*)?$/i.test(base) && base.toLowerCase() !== '.env.example') reason = 'env files hold secrets and are never edited by the agent';
  else if (privateFolders().some((seg) => new RegExp(`(^|/)${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`, 'i').test(p))) reason = 'path is inside a private folder (see your private-paths.txt)';
  else if (/(^|\/)\.git(\/|$)/.test(p)) reason = '.git internals are off limits';
  if (reason) {
    emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `Blocked by project guard: ${reason}.` } });
  }
});
