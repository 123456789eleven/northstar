// Practice tab (Money): a risk-free space for paper trading, a private trade journal and calculators.
// Simulated money only. No brokerage, no trade execution, no buy or sell recommendations.
import { useState } from 'react'
import { Tabs } from '../../components/ui'
import AccountPanel from './AccountPanel'
import JournalPanel, { type DraftSeed } from './JournalPanel'
import ToolsPanel from './ToolsPanel'
import './practice.css'

type View = 'account' | 'journal' | 'tools'

export default function PracticeTab() {
  const [view, setView] = useState<View>('account')
  const [seed, setSeed] = useState<DraftSeed>(null)
  return (
    <div className="pr">
      <p className="pr-banner">Paper account: simulated money. Nothing here places a real trade, and Northstar never tells you what to buy or sell.</p>
      <Tabs value={view} onChange={setView} options={[{ value: 'account', label: 'Account' }, { value: 'journal', label: 'Journal' }, { value: 'tools', label: 'Tools' }]} />
      {view === 'account' && <AccountPanel onJournal={(tradeId, symbol) => { setSeed({ tradeId, symbol }); setView('journal') }} />}
      {view === 'journal' && <JournalPanel seed={seed} clearSeed={() => setSeed(null)} />}
      {view === 'tools' && <ToolsPanel />}
    </div>
  )
}
