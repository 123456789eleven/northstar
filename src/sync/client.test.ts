import { afterEach, describe, expect, it, vi } from 'vitest'
import { appRedirectUrl, authErrorMessage, envConfig, signUpOutcome, validateConfig } from './client'

const KEY = 'sb_publishable_' + 'x'.repeat(30)

describe('sync client config', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('accepts the new publishable key format', () => {
    expect(validateConfig({ url: 'https://abcd1234.supabase.co', anonKey: KEY })).toBeNull()
  })
  it('reads either env var name', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd1234.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', KEY)
    expect(envConfig()).toEqual({ url: 'https://abcd1234.supabase.co', anonKey: KEY })
  })
})

describe('sign-up helpers', () => {
  it('confirmation link returns to the app path', () => {
    expect(appRedirectUrl({ origin: 'https://x.github.io', pathname: '/northstar/app/' })).toBe('https://x.github.io/northstar/app/')
  })
  it('classifies outcomes', () => {
    expect(signUpOutcome({ session: {}, user: { identities: [{}] } })).toBe('signed-in')
    expect(signUpOutcome({ session: null, user: { identities: [{}] } })).toBe('confirm')
    expect(signUpOutcome({ session: null, user: { identities: [] } })).toBe('exists')
  })
  it('rewrites common errors', () => {
    expect(authErrorMessage('email rate limit exceeded')).toMatch(/limiting/)
    expect(authErrorMessage('Email not confirmed')).toMatch(/confirmation email/)
    expect(authErrorMessage('Password should be at least 10 characters.')).toBe('Password should be at least 10 characters.')
  })
})
