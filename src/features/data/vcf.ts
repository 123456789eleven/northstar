// Pure .vcf (vCard 2.1 / 3.0 / 4.0) parser. Phone numbers and emails are deliberately not imported.
export interface VcfContact {
  name: string
  relation: string
  /** MM-DD */
  birthday?: string
  notes?: string
}

export interface VcfResult {
  contacts: VcfContact[]
  skipped: number
}

function decodeQp(s: string, charset = 'utf-8') {
  const bytes: number[] = []
  const t = s.replace(/=\r?\n/g, '')
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      bytes.push(parseInt(t.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(t.charCodeAt(i) & 0xff)
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes))
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  }
}

const unescape = (s: string) => s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))

/** Splits on unescaped semicolons. */
const splitSemi = (s: string) => s.split(/(?<!\\);/).map(unescape)

export function parseBirthday(v: string): string | undefined {
  const s = v.trim()
  let m = /^--(\d{2})-?(\d{2})$/.exec(s) ?? /^\d{4}-?(\d{2})-?(\d{2})(?:T.*)?$/.exec(s)
  if (!m) m = null
  if (!m) return undefined
  const [mo, d] = [Number(m[1]), Number(m[2])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  return `${m[1]}-${m[2]}`
}

function logicalLines(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    const prev = out[out.length - 1]
    if (prev !== undefined && /^[ \t]/.test(line)) {
      out[out.length - 1] = prev + line.slice(1)
    } else if (prev !== undefined && /QUOTED-PRINTABLE/i.test(prev.split(':')[0]) && prev.endsWith('=')) {
      out[out.length - 1] = prev.slice(0, -1) + line
    } else out.push(line)
  }
  return out
}

export function parseVcf(text: string): VcfResult {
  const contacts: VcfContact[] = []
  let skipped = 0
  let card: Record<string, string> | null = null
  for (const line of logicalLines(text)) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const headParts = line.slice(0, colon).split(';')
    const name = headParts[0].replace(/^.*\./, '').toUpperCase() // strip "item1." group
    let value = line.slice(colon + 1)
    if (name === 'BEGIN' && value.toUpperCase() === 'VCARD') {
      card = {}
      continue
    }
    if (name === 'END' && value.toUpperCase() === 'VCARD') {
      if (card) {
        const c = build(card)
        if (c) contacts.push(c)
        else skipped++
      }
      card = null
      continue
    }
    if (!card) continue
    const params = headParts.slice(1).join(';')
    if (/QUOTED-PRINTABLE/i.test(params)) value = decodeQp(value, /CHARSET=([\w-]+)/i.exec(params)?.[1])
    if (!(name in card)) card[name] = value
  }
  return { contacts, skipped }
}

function build(c: Record<string, string>): VcfContact | null {
  let name = c.FN ? unescape(c.FN).trim() : ''
  if (!name && c.N) {
    const [family = '', given = '', , prefix = '', suffix = ''] = splitSemi(c.N)
    name = [prefix, given, family, suffix].map((x) => x.trim()).filter(Boolean).join(' ')
  }
  if (!name && c.ORG) name = splitSemi(c.ORG)[0].trim()
  if (!name) return null
  const org = c.ORG ? splitSemi(c.ORG)[0].trim() : ''
  const title = c.TITLE ? unescape(c.TITLE).trim() : ''
  const relation = title && org ? `${title}, ${org}` : org || title
  const note = c.NOTE ? unescape(c.NOTE).trim() : ''
  const birthday = c.BDAY ? parseBirthday(c.BDAY) : undefined
  return { name, relation, ...(birthday && { birthday }), ...(note && { notes: note }) }
}
