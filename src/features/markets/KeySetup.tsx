// Setup card for optional live prices. Place it wherever the Markets UI needs it; it renders nothing else.
import { useState } from 'react'
import { Card, Field } from '../../components/ui'
import { finnhub, isPlausibleKey, MarketError } from './finnhub'
import { useFinnhubKey } from './hooks'
import './markets.css'

type Msg = { tone: 'ok' | 'error'; text: string } | null

export default function KeySetup() {
  const { hasKey, hint, setKey, clearKey } = useFinnhubKey()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const explain = (e: unknown): string => (e instanceof MarketError ? e.message : 'Something went wrong. Try again.')

  async function test() {
    setBusy(true)
    setMsg(null)
    try {
      await finnhub.testKey(value.trim())
      setMsg({ tone: 'ok', text: 'Finnhub accepted this key.' })
    } catch (e) {
      setMsg({ tone: 'error', text: explain(e) })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      await finnhub.testKey(value.trim())
      await setKey(value)
      setValue('')
      setMsg({ tone: 'ok', text: 'Saved on this device. Live prices are on.' })
    } catch (e) {
      setMsg({ tone: 'error', text: explain(e) })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    await clearKey()
    setValue('')
    setMsg({ tone: 'ok', text: 'Key removed. Live prices are off.' })
  }

  const plausible = isPlausibleKey(value.trim())

  return (
    <Card title="Live prices" sub={hasKey ? `On. Key ending ${hint.slice(-4)}.` : 'Off until you add your own free Finnhub key.'}>
      <div className="mkt-box">
        <b>What leaves this device</b>
        <ul>
          <li>Ticker symbols, such as VTI, are sent to Finnhub to get prices. Nothing else is sent.</li>
          <li>Your balances, share counts, cost basis and notes never leave this device.</li>
          <li>Your key is stored on this device only. It is not synced and not included in backups.</li>
        </ul>
      </div>
      <p className="mkt-note">
        Prices are for reference and may be delayed or wrong. Northstar gives no investment advice and cannot place trades.
      </p>
      <p className="mkt-note">
        No key yet?{' '}
        <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer">
          Get a free key at finnhub.io
        </a>
        .
      </p>
      <Field label={hasKey ? 'Replace key' : 'Finnhub API key'} error={msg?.tone === 'error' ? msg.text : undefined} hint={msg?.tone === 'ok' ? msg.text : undefined}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          name="finnhub-key"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setMsg(null)
          }}
          placeholder="Paste your key"
        />
      </Field>
      <div className="row mkt-actions">
        <button type="button" className="btn" disabled={busy || !plausible} onClick={test}>
          Test
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !plausible} onClick={save}>
          Save
        </button>
        {hasKey && (
          <button type="button" className="btn" disabled={busy} onClick={remove}>
            Remove key
          </button>
        )}
      </div>
    </Card>
  )
}
