import { describe, expect, it } from 'vitest'
import { parseBirthday, parseVcf } from './vcf'

describe('parseVcf', () => {
  it('parses a 3.0 card with folding, org/title, bday, note, and ignores tel/email', () => {
    const t = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ada Lovelace', 'N:Lovelace;Ada;;;', 'ORG:Analytical Engines;R&D', 'TITLE:Engineer', 'TEL;TYPE=CELL:555-1234', 'EMAIL:ada@example.com', 'BDAY:1985-03-14', 'NOTE:Met at a conf\\, loved it\\nCall in', ' the spring', 'END:VCARD'].join('\r\n')
    const r = parseVcf(t)
    expect(r.contacts).toEqual([{ name: 'Ada Lovelace', relation: 'Engineer, Analytical Engines', birthday: '03-14', notes: 'Met at a conf, loved it\nCall inthe spring' }])
    expect(JSON.stringify(r)).not.toContain('555')
    expect(JSON.stringify(r)).not.toContain('example.com')
  })

  it('falls back to N when FN is missing (2.1)', () => {
    const r = parseVcf('BEGIN:VCARD\nVERSION:2.1\nN:Smith;John;Q;Dr.;Jr.\nBDAY:19700102\nEND:VCARD')
    expect(r.contacts[0]).toMatchObject({ name: 'Dr. John Smith Jr.', birthday: '01-02', relation: '' })
  })

  it('decodes quoted-printable with soft breaks and UTF-8', () => {
    const t = 'BEGIN:VCARD\r\nVERSION:2.1\r\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Gar=\r\nc=C3=ADa\r\nNOTE;ENCODING=QUOTED-PRINTABLE:caf=C3=A9\r\nEND:VCARD'
    const r = parseVcf(t)
    expect(r.contacts[0].name).toBe('José García')
    expect(r.contacts[0].notes).toBe('café')
  })

  it('handles 4.0 yearless birthdays, grouped props, multiple cards and nameless cards', () => {
    const t = 'BEGIN:VCARD\nVERSION:4.0\nitem1.FN:Bo\nBDAY:--0229\nEND:VCARD\nBEGIN:VCARD\nVERSION:4.0\nTEL:1\nEND:VCARD\nBEGIN:VCARD\nFN:Cy\nBDAY:--12-25\nEND:VCARD'
    const r = parseVcf(t)
    expect(r.contacts.map((c) => [c.name, c.birthday])).toEqual([['Bo', '02-29'], ['Cy', '12-25']])
    expect(r.skipped).toBe(1)
  })

  it('rejects bad birthdays', () => {
    expect(parseBirthday('1985-13-40')).toBeUndefined()
    expect(parseBirthday('nonsense')).toBeUndefined()
    expect(parseBirthday('1985-03-14T00:00:00Z')).toBe('03-14')
  })
})
