// Device-local game preferences (settings keys under `game.`, never synced; see isLocalOnlySetting).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'

export interface GameSettings {
  calm: boolean
  haptics: boolean
  sound: boolean
  motion: 'full' | 'reduced'
  weekTarget: number
}

export const GAME_DEFAULTS: GameSettings = { calm: false, haptics: false, sound: false, motion: 'full', weekTarget: 5 }

export const gameKey = (k: keyof GameSettings) => `game.${k}`

export function parseGameSettings(raw: Record<string, unknown>): GameSettings {
  const bool = (k: keyof GameSettings, d: boolean) => (typeof raw[gameKey(k)] === 'boolean' ? (raw[gameKey(k)] as boolean) : d)
  const wt = Number(raw[gameKey('weekTarget')])
  const m = raw[gameKey('motion')]
  return {
    calm: bool('calm', GAME_DEFAULTS.calm),
    haptics: bool('haptics', GAME_DEFAULTS.haptics),
    sound: bool('sound', GAME_DEFAULTS.sound),
    motion: m === 'reduced' || m === 'full' ? m : GAME_DEFAULTS.motion,
    weekTarget: Number.isFinite(wt) && wt >= 1 ? Math.min(7, Math.round(wt)) : GAME_DEFAULTS.weekTarget,
  }
}

export interface GameSettingsApi extends GameSettings {
  loading: boolean
  set: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => Promise<void>
  setCalm: (v: boolean) => Promise<void>
  setHaptics: (v: boolean) => Promise<void>
  setSound: (v: boolean) => Promise<void>
  setMotion: (v: GameSettings['motion']) => Promise<void>
  setWeekTarget: (v: number) => Promise<void>
}

export async function setGameSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
  const v = key === 'weekTarget' ? Math.min(7, Math.max(1, Math.round(Number(value)))) : value
  await setSetting(gameKey(key), v)
}

export function useGameSettings(): GameSettingsApi {
  const rows = useLiveQuery(() => db.settings.where('key').startsWith('game.').toArray(), [])
  const s = parseGameSettings(Object.fromEntries((rows ?? []).map((r) => [r.key, r.value])))
  return {
    ...s,
    loading: rows === undefined,
    set: setGameSetting,
    setCalm: (v) => setGameSetting('calm', v),
    setHaptics: (v) => setGameSetting('haptics', v),
    setSound: (v) => setGameSetting('sound', v),
    setMotion: (v) => setGameSetting('motion', v),
    setWeekTarget: (v) => setGameSetting('weekTarget', v),
  }
}
