// Shortcut list + helpers (no components, so Shortcuts.tsx stays fast-refresh friendly).
// Keep SHORTCUT_GROUPS in step with the real handlers: Shell (Ctrl/Cmd K), QuickCapture (/), CommandPalette,
// pages/Tasks (j k Enter x), pages/Ops (j k a e), journal/FocusMode (Esc, Ctrl/Cmd Enter).
export const OPEN_SHORTCUTS = 'ns:shortcuts'
export const openShortcuts = () => window.dispatchEvent(new Event(OPEN_SHORTCUTS))

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? 'Cmd' : 'Ctrl'

export interface ShortcutGroup { name: string; items: Array<{ keys: string[][]; label: string }> }

/** keys: alternatives (outer) of key sequences pressed together (inner). */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    name: 'Anywhere',
    items: [
      { keys: [[MOD, 'K']], label: 'Search and commands' },
      { keys: [['/']], label: 'Focus the capture bar' },
      { keys: [['?']], label: 'Show these shortcuts' },
      { keys: [['Esc']], label: 'Close a dialog, sheet or panel' },
    ],
  },
  {
    name: 'Capture bar',
    items: [
      { keys: [['Enter']], label: 'Add what you typed' },
      { keys: [['Esc']], label: 'Clear and leave the bar' },
    ],
  },
  {
    name: 'Search',
    items: [
      { keys: [['Up'], ['Down']], label: 'Move through results' },
      { keys: [['Home'], ['End']], label: 'First or last result' },
      { keys: [['Enter']], label: 'Open the highlighted result' },
    ],
  },
  {
    name: 'Tasks',
    items: [
      { keys: [['j'], ['k']], label: 'Next or previous task' },
      { keys: [['Enter']], label: 'Open the selected task' },
      { keys: [['x']], label: 'Complete the selected task' },
    ],
  },
  {
    name: 'Command',
    items: [
      { keys: [['j'], ['k']], label: 'Next or previous proposal' },
      { keys: [['a']], label: 'Accept the selected proposal' },
      { keys: [['e']], label: 'Show or hide its evidence' },
    ],
  },
  {
    name: 'Journal focus mode',
    items: [
      { keys: [[MOD, 'Enter']], label: 'Next prompt (guided entries)' },
      { keys: [['Esc']], label: 'Leave focus mode' },
    ],
  },
]

/** True when a keystroke should be treated as typing, not as a shortcut. */
export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? '') || !!el.isContentEditable
}
