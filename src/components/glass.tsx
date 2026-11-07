// GlassSurface: the one way to put a glass layer in a component. Tier decides strength (thin = chrome, regular = cards, thick = sheets).
// Never use it for list rows, table cells or chart plots (docs/redesign/DESIGN_BRIEF.md).
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type GlassTier = 'thin' | 'regular' | 'thick'

export function GlassSurface({ tier = 'regular', as: Tag = 'div', specular = false, className = '', children, ...rest }: { tier?: GlassTier; as?: ElementType; specular?: boolean; className?: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return <Tag className={`glass-${tier} ${className}`} data-spec={specular ? '' : undefined} {...rest}>{children}</Tag>
}
