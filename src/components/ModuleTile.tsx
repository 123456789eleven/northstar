// Aurora gradient icon tile: the module's line icon on its hue (moduleHue.ts). Decorative: always next to a text label.
import { Icon, type IconName } from './Icons'
import { hueFor } from './moduleHue'

export default function ModuleTile({ icon, size = 'md' }: { icon: IconName; size?: 'md' | 'sm' }) {
  return (
    <span className={`tile hue-${hueFor(icon)} ${size === 'sm' ? 'tile-sm' : ''}`} aria-hidden>
      <Icon name={icon} size={size === 'sm' ? 14 : 20} />
    </span>
  )
}
