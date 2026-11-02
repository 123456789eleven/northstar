// statusLine: one line - branch, dirty count, model, context usage. Prints only fields that exist.
import { spawnSync } from 'node:child_process';
import { readInput, safe } from './_lib.mjs';

safe(() => {
  const input = readInput();
  const cwd = input.workspace?.current_dir || input.cwd || process.cwd();
  const parts = [];
  const git = (args) => spawnSync(`git ${args}`, { cwd, shell: true, encoding: 'utf8', timeout: 3000, windowsHide: true });
  const b = git('branch --show-current');
  if (b.status === 0) {
    const branch = (b.stdout || '').trim();
    if (branch) parts.push(branch);
    const s = git('status --porcelain');
    if (s.status === 0) {
      const n = (s.stdout || '').split(/\r?\n/).filter(Boolean).length;
      parts.push(n ? `${n} dirty` : 'clean');
    }
  }
  const model = input.model?.display_name;
  if (model) parts.push(model);
  const pct = input.context_window?.used_percentage;
  if (typeof pct === 'number') parts.push(`ctx ${Math.round(pct)}%`);
  process.stdout.write(parts.join(' | ') + '\n');
});
