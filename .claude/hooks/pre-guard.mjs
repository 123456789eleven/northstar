// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): deny secrets / private paths / .git internals.
import { readInput, emit, safe, norm } from './_lib.mjs';

safe(() => {
  const input = readInput();
  const file = input.tool_input?.file_path || input.tool_input?.notebook_path || input.tool_input?.path;
  if (!file) return;
  const p = norm(file);
  const base = p.split('/').pop() || '';
  let reason = '';
  if (/^\.env(\..*)?$/i.test(base) && base.toLowerCase() !== '.env.example') reason = 'env files hold secrets and are never edited by the agent';
  else if (/northstar-private/i.test(p) || /passphrase/i.test(p)) reason = 'path is marked private (northstar-private / Passphrase)';
  else if (/(^|\/)\.git(\/|$)/.test(p)) reason = '.git internals are off limits';
  if (reason) {
    emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `Blocked by project guard: ${reason}.` } });
  }
});
