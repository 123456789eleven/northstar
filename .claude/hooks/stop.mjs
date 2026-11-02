// Stop: informational only, never blocks. Throttled typecheck + slow-turn Windows notification.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readInput, emit, safe, tmp } from './_lib.mjs';

const THROTTLE_MS = 120_000;
const SLOW_MS = 90_000;

function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function notify(text) {
  const ps = 'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; ' +
    '$n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; ' +
    "$n.BalloonTipTitle = 'Claude Code'; $n.BalloonTipText = '" + text.replace(/'/g, "''") + "'; $n.Visible = $true; " +
    '$n.ShowBalloonTip(5000); Start-Sleep -Seconds 6; $n.Dispose()';
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  child.unref();
}

safe(() => {
  const input = readInput();
  if (input.stop_hook_active) return;
  const cwd = input.cwd || process.cwd();
  const id = String(input.session_id || 'default').replace(/[^\w-]/g, '');

  // slow-turn notification
  if (process.platform === 'win32' && !process.env.NORTHSTAR_NO_NOTIFY) {
    try {
      const started = Number(fs.readFileSync(tmp(`northstar-claude-turn-${id}.txt`), 'utf8'));
      if (started && Date.now() - started > SLOW_MS) notify('Turn finished (took over 90 seconds).');
    } catch { /* no timestamp */ }
  }

  // throttled typecheck
  if (!fs.existsSync(path.join(cwd, 'package.json'))) return;
  const st = spawnSync('git status --porcelain', { cwd, shell: true, encoding: 'utf8', timeout: 10000, windowsHide: true });
  if (st.status !== 0) return;
  const hash = crypto.createHash('sha1').update(st.stdout || '').digest('hex');
  const cwdKey = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 10);
  const stateFile = tmp(`northstar-claude-tc-${cwdKey}.json`);
  const prev = readJson(stateFile);
  const now = Date.now();
  if (prev && (now - prev.time < THROTTLE_MS || prev.hash === hash)) return;
  fs.writeFileSync(stateFile, JSON.stringify({ time: now, hash }));

  const r = spawnSync('npm run typecheck', { cwd, shell: true, encoding: 'utf8', timeout: 100000, windowsHide: true });
  if (r.status === 0 || r.error) return;
  const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  const errs = out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
  if (!errs.length) return;
  emit({ systemMessage: `Typecheck: ${errs.length} error(s). First ${Math.min(3, errs.length)}:\n${errs.slice(0, 3).join('\n')}` });
});
