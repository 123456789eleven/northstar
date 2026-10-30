// UI-facing wrapper: loading demo data over real data needs an explicit confirmation.
import { hasUserData, loadDemo } from '../../lib/demo'

export const DEMO_CONFIRM = 'You already have data here. The demo data will be added alongside it and can be removed later without touching yours. Add it?'

/** Returns 'loaded', 'cancelled' or 'already'. `confirm` is injectable for tests. */
export async function loadDemoWithConfirm(confirm: (msg: string) => boolean = (m) => window.confirm(m)): Promise<'loaded' | 'cancelled' | 'already'> {
  if ((await hasUserData()) && !confirm(DEMO_CONFIRM)) return 'cancelled'
  return (await loadDemo()) ? 'loaded' : 'already'
}
