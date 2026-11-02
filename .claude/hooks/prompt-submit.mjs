// UserPromptSubmit: remember when the turn started (used by the Stop hook for the slow-turn notification).
import fs from 'node:fs';
import { readInput, safe, tmp } from './_lib.mjs';

safe(() => {
  const input = readInput();
  const id = String(input.session_id || 'default').replace(/[^\w-]/g, '');
  fs.writeFileSync(tmp(`northstar-claude-turn-${id}.txt`), String(Date.now()));
});
