// PostToolUse (Edit|Write|MultiEdit): lint edited src .ts/.tsx; privacy reminder for sensitive paths.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readInput, emit, safe, norm } from './_lib.mjs';

safe(() => {
  const input = readInput();
  const cwd = input.cwd || process.cwd();
  const file = input.tool_input?.file_path || input.tool_input?.path;
  if (!file) return;
  const abs = path.resolve(cwd, file);
  const rel = norm(path.relative(cwd, abs));
  if (rel.startsWith('..')) return;

  const notes = [];

  // Only lint plain, expected paths: the command runs through a shell, so refuse anything with quotes, $, backticks, etc.
  if (/^src\/.+\.tsx?$/.test(rel) && /^[\w@.\/: -]+$/.test(norm(abs))) {
    const r = spawnSync(`npx oxlint "${abs}"`, { cwd, shell: true, encoding: 'utf8', timeout: 20000, windowsHide: true });
    const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
    const clean = /Found 0 warnings and 0 errors/.test(out);
    if (out && !clean && (r.status !== 0 || /warning|error/i.test(out))) {
      notes.push(`oxlint on ${rel}:\n${out.slice(0, 1500)}`);
    }
  }

  if (rel.startsWith('src/sync/') || rel.startsWith('supabase/') || rel === 'src/db.ts') {
    notes.push(`Reminder: ${rel} is privacy-sensitive. Follow the privacy checklist (skill northstar-privacy-audit) and request a security review before shipping.`);
  }

  if (notes.length) {
    emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n\n') } });
  }
});
