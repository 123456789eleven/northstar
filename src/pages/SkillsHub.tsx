// Skills hub (/skills): the constellation and the five life skills. Calm mode keeps the cards, drops levels and XP.
import { PageHeader, Card } from '../components/ui'
import type { IconName } from '../components/Icons'
import { usePlayerState } from '../features/game/ui/playerContext'
import { Constellation } from '../features/game/ui/Constellation'
import { LevelBadge } from '../features/game/ui/Ring'
import { XpBar } from '../features/game/ui/Meters'
import type { SkillId } from '../features/game/types'
import { HubCard } from '../features/hubs/HubCard'
import '../features/hubs/hubs.css'

const PAGES: Record<SkillId, { to: string; icon: IconName; sub: string }> = {
  body: { to: '/body', icon: 'body', sub: 'Weight, food and training' },
  money: { to: '/finance', icon: 'finance', sub: 'Budgets, spending and net worth' },
  mind: { to: '/mind', icon: 'mind', sub: 'Journal and learning' },
  career: { to: '/career', icon: 'career', sub: 'Wins and your promotion case' },
  people: { to: '/people', icon: 'people', sub: 'Who to reach out to' },
}

export default function SkillsHub() {
  const p = usePlayerState()
  return (
    <>
      <PageHeader title="Skills" sub={p.calm ? 'Body, money, mind, career and people.' : 'Five life skills. Every real thing you log brightens a star.'} />
      {!p.calm && (
        <div className="hub-section">
          <Card title="Constellation" action={<span className="small muted">Level <span className="mono">{p.level}</span> overall</span>}>
            <Constellation skills={p.skills} />
          </Card>
        </div>
      )}
      <div className="hub-grid">
        {p.skills.map((s) => {
          const page = PAGES[s.id]
          return (
            <HubCard key={s.id} to={page.to} icon={page.icon} title={s.label} sub={page.sub} stat={!p.calm && s.todayXp ? <span className="hub-today-xp">+{s.todayXp} XP today</span> : undefined}>
              {!p.calm && (
                <span className="hub-meter">
                  <LevelBadge level={s.level} progress={s.xpForNext ? s.xpIntoLevel / s.xpForNext : 0} size={40} tone={s.id} label={`${s.label} level ${s.level}`} />
                  <XpBar info={s} label={`${s.label} level ${s.level}`} />
                </span>
              )}
            </HubCard>
          )
        })}
      </div>
    </>
  )
}
