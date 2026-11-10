// Practice tools: growth projector, position size, bond calculator, DCA. Arithmetic on your inputs, never a forecast or advice.
import { useMemo, useState } from 'react'
import { Card, Field, Tabs } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import { money } from '../../lib/dates'
import { currentYield, duration, yieldToMaturity } from '../markets/bonds'
import { GROWTH_DISCLAIMER, projectRange } from '../markets/growth'
import { BandChart, SplitChart } from './charts'
import { bandRows, dca, parseNum, parsePrices, positionSize, splitRows, type Parsed } from './calc'

type Tool = 'growth' | 'size' | 'bond' | 'dca'

function useFields<K extends string>(init: Record<K, string>) {
  const [v, setV] = useState(init)
  return [v, (k: K) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }))] as const
}

const firstError = (...r: Parsed<unknown>[]) => r.find((x): x is { ok: false; error: string } => !x.ok)?.error ?? ''

function NumField({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className="input" inputMode="decimal" value={value} onChange={onChange} aria-invalid={!!error} />
    </Field>
  )
}

function Result({ rows }: { rows: [string, string, string?][] }) {
  return (
    <dl className="pr-result" aria-live="polite">
      {rows.map(([k, v, tone]) => <div key={k}><dt>{k}</dt><dd className={tone}>{v}</dd></div>)}
    </dl>
  )
}

function Growth() {
  const [f, on] = useFields({ principal: '10000', monthly: '500', years: '20', low: '3', base: '6', high: '9' })
  const p = parseNum(f.principal, 'Starting amount', { min: 0 }), m = parseNum(f.monthly, 'Monthly contribution', { min: 0 })
  const y = parseNum(f.years, 'Years', { positive: true, max: 100 })
  const lo = parseNum(f.low, 'Low return', { min: -50, max: 50 }), ba = parseNum(f.base, 'Middle return', { min: -50, max: 50 }), hi = parseNum(f.high, 'High return', { min: -50, max: 50 })
  const err = firstError(p, m, y, lo, ba, hi)
  const out = useMemo(() => {
    if (!p.ok || !m.ok || !y.ok || !lo.ok || !ba.ok || !hi.ok) return null
    const r = projectRange({ principal: p.value, monthlyContribution: m.value, years: y.value }, { low: lo.value, base: ba.value, high: hi.value })
    return { r, band: bandRows(r.low.points, r.base.points, r.high.points), split: splitRows(r.base.points) }
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const bandLabel = out ? `Illustration of balance over ${f.years} years: low case ${money(out.r.low.final)}, middle case ${money(out.r.base.final)}, high case ${money(out.r.high.final)}.` : ''
  const splitLabel = out ? `Middle case: ${money(out.r.base.contributed)} contributed and ${money(out.r.base.growth)} growth, ${money(out.r.base.final)} in total.` : ''
  return (
    <div className="pr-stack">
      <Card title="Growth projector" sub="An illustration, not a forecast">
        <div className="pr-fields">
          <NumField label="Starting amount ($)" value={f.principal} onChange={on('principal')} />
          <NumField label="Monthly contribution ($)" value={f.monthly} onChange={on('monthly')} />
          <NumField label="Years" value={f.years} onChange={on('years')} />
          <NumField label="Low return (% a year)" value={f.low} onChange={on('low')} />
          <NumField label="Middle return (% a year)" value={f.base} onChange={on('base')} />
          <NumField label="High return (% a year)" value={f.high} onChange={on('high')} />
        </div>
        {err && <p className="field-error" role="alert">{err}</p>}
        <p className="pr-illus">An illustration, not a forecast. {GROWTH_DISCLAIMER}</p>
      </Card>
      {out && (
        <>
          <ChartFrame
            title="Low, middle and high"
            sub={<>Three assumed returns. <span className="mono">{money(out.r.low.final)}</span> low, <span className="mono">{money(out.r.base.final)}</span> middle, <span className="mono">{money(out.r.high.final)}</span> high after {f.years} years.</>}
            legend={[{ label: 'High', color: '#a9a7ba', line: true }, { label: 'Middle', color: '#9cc8e6', line: true }, { label: 'Low', color: '#6b7280', line: true }]}
            table={<div className="table-wrap"><table className="table"><thead><tr><th>Year</th><th>Low</th><th>Middle</th><th>High</th></tr></thead><tbody>{out.band.map((r) => <tr key={r.year}><td>{r.year}</td><td className="mono">{money(r.low)}</td><td className="mono">{money(r.base)}</td><td className="mono">{money(r.high)}</td></tr>)}</tbody></table></div>}
          >
            <BandChart rows={out.band} label={bandLabel} />
          </ChartFrame>
          <ChartFrame
            title="Contributions and growth (middle case)"
            sub={<>You put in <span className="mono">{money(out.r.base.contributed)}</span>; the assumed return adds <span className="mono">{money(out.r.base.growth)}</span>.</>}
            legend={[{ label: 'Contributions', color: '#6b7280' }, { label: 'Growth', color: '#9cc8e6' }]}
            table={<div className="table-wrap"><table className="table"><thead><tr><th>Year</th><th>Contributed</th><th>Growth</th></tr></thead><tbody>{out.split.map((r) => <tr key={r.year}><td>{r.year}</td><td className="mono">{money(r.contributed)}</td><td className="mono">{money(r.growth)}</td></tr>)}</tbody></table></div>}
          >
            <SplitChart rows={out.split} label={splitLabel} />
          </ChartFrame>
        </>
      )}
    </div>
  )
}

function Size() {
  const [f, on] = useFields({ account: '25000', risk: '1', entry: '50', stop: '48' })
  const a = parseNum(f.account, 'Account size', { positive: true }), r = parseNum(f.risk, 'Risk per trade', { positive: true, max: 100 })
  const e = parseNum(f.entry, 'Entry price', { positive: true }), s = parseNum(f.stop, 'Stop price', { positive: true })
  const err = firstError(a, r, e, s)
  const res = !err && a.ok && r.ok && e.ok && s.ok ? positionSize({ account: a.value, riskPct: r.value, entry: e.value, stop: s.value }) : null
  return (
    <Card title="Position size" sub="How many shares keep a loss at your chosen risk if the stop is hit.">
      <div className="pr-fields">
        <NumField label="Account size ($)" value={f.account} onChange={on('account')} />
        <NumField label="Risk per trade (%)" value={f.risk} onChange={on('risk')} />
        <NumField label="Entry price ($)" value={f.entry} onChange={on('entry')} />
        <NumField label="Stop price ($)" value={f.stop} onChange={on('stop')} />
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
      {res && !res.ok && <p className="field-error" role="alert">{res.error}</p>}
      {res?.ok && (
        <>
          <Result rows={[
            ['Dollar risk', money(res.value.dollarRisk)],
            ['Risk per share', money(res.value.riskPerShare)],
            ['Shares', res.value.wholeShares.toLocaleString()],
            ['Position value', `${money(res.value.positionValue)} (${res.value.pctOfAccount.toFixed(0)}% of account)`, res.value.exceedsAccount ? 'warn' : ''],
          ]} />
          <p className="pr-help">Shares = dollar risk ÷ risk per share, rounded down{res.value.shares !== res.value.wholeShares ? ` (${res.value.shares} with fractions)` : ''}. This is a {res.value.direction} setup because the stop is {res.value.direction === 'long' ? 'below' : 'above'} the entry.{res.value.exceedsAccount ? ' The position is larger than the account, so it would need borrowed money.' : ''}</p>
        </>
      )}
    </Card>
  )
}

function Bond() {
  const [f, on] = useFields({ price: '95', face: '100', coupon: '4', years: '10', freq: '2' })
  const p = parseNum(f.price, 'Price', { positive: true }), fa = parseNum(f.face, 'Face value', { positive: true })
  const c = parseNum(f.coupon, 'Coupon rate', { min: 0, max: 100 }), y = parseNum(f.years, 'Years to maturity', { positive: true, max: 100 })
  const err = firstError(p, fa, c, y)
  const input = p.ok && fa.ok && c.ok && y.ok ? { price: p.value, face: fa.value, couponRatePct: c.value, yearsToMaturity: y.value, frequency: Number(f.freq) } : null
  const ytm = input && !err ? yieldToMaturity(input) : null
  const cy = input && !err ? currentYield(input) : null
  const dur = input && !err ? duration(input) : null
  const invalid = !!input && !err && ytm === null
  return (
    <Card title="Bond calculator" sub="Fixed coupon, par repaid at maturity. Price is per face value.">
      <div className="pr-fields">
        <NumField label="Price" value={f.price} onChange={on('price')} />
        <NumField label="Face value" value={f.face} onChange={on('face')} />
        <NumField label="Coupon rate (% a year)" value={f.coupon} onChange={on('coupon')} />
        <NumField label="Years to maturity" value={f.years} onChange={on('years')} hint="At least one coupon period." />
        <Field label="Coupons per year"><select className="select" value={f.freq} onChange={on('freq')}><option value="1">Annual</option><option value="2">Semiannual</option><option value="4">Quarterly</option><option value="12">Monthly</option></select></Field>
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
      {invalid && <p className="field-error" role="alert">These numbers do not give a valid yield. Check the price, coupon and years.</p>}
      {ytm !== null && cy !== null && dur && (
        <>
          <Result rows={[
            ['Yield to maturity', `${(ytm * 100).toFixed(2)}%`],
            ['Current yield', `${(cy * 100).toFixed(2)}%`],
            ['Duration (modified)', `${dur.modified.toFixed(2)} years`],
            ['Duration (Macaulay)', `${dur.macaulay.toFixed(2)} years`],
          ]} />
          <ul className="pr-explain">
            <li><b>Yield to maturity</b> is the annual return if you hold to maturity, collect every coupon and are repaid face value. It is why a bond bought below face value yields more than its coupon.</li>
            <li><b>Current yield</b> is just the yearly coupon divided by price. It ignores the gain or loss at maturity.</li>
            <li><b>Duration</b> measures rate sensitivity. If yields rise 1 percentage point, this bond&apos;s price falls roughly {dur.modified.toFixed(1)}%; if they fall 1 point, it rises about as much.</li>
          </ul>
        </>
      )}
    </Card>
  )
}

function Dca() {
  const [f, on] = useFields({ amount: '200', prices: '50, 46, 42, 48, 55, 58' })
  const a = parseNum(f.amount, 'Amount per period', { positive: true })
  const pr = parsePrices(f.prices)
  const err = firstError(a, pr)
  const res = a.ok && pr.ok ? dca(a.value, pr.value) : null
  return (
    <Card title="Dollar-cost averaging" sub="Invest the same amount each period, using the prices you enter, one per period.">
      <div className="pr-fields">
        <NumField label="Amount each period ($)" value={f.amount} onChange={on('amount')} />
        <Field label="Price at each period" hint="Comma separated, oldest first.">
          <input className="input" value={f.prices} onChange={on('prices')} aria-invalid={!pr.ok} />
        </Field>
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
      {res?.ok && (
        <>
          <Result rows={[
            ['Invested', money(res.value.invested)],
            ['Shares bought', String(res.value.shares)],
            ['Average cost', money(res.value.avgCost)],
            ['Value at last price', `${money(res.value.finalValue)} (${res.value.gain >= 0 ? '+' : '−'}${money(Math.abs(res.value.gain))})`],
            ['Same total at the first price', `${money(res.value.lumpValue)} (${res.value.lumpGain >= 0 ? '+' : '−'}${money(Math.abs(res.value.lumpGain))})`],
          ]} />
          <p className="pr-help">Averaging in spreads purchases across prices, so the average cost sits between the highest and lowest price. Whether it beats a single purchase depends on the path the prices took.</p>
        </>
      )}
    </Card>
  )
}

export default function ToolsPanel() {
  const [tool, setTool] = useState<Tool>('growth')
  return (
    <div className="pr-stack">
      <Tabs value={tool} onChange={setTool} options={[{ value: 'growth', label: 'Growth' }, { value: 'size', label: 'Position size' }, { value: 'bond', label: 'Bonds' }, { value: 'dca', label: 'DCA' }]} />
      {tool === 'growth' && <Growth />}
      {tool === 'size' && <Size />}
      {tool === 'bond' && <Bond />}
      {tool === 'dca' && <Dca />}
    </div>
  )
}
