import { describe, expect, it } from 'vitest'
import { maskAccount, ofxKey, parseOfx, parseOfxAmount, parseOfxDate } from './ofx'
import { planImport } from './dedupe'

const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260315120000<LANGUAGE>ENG</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>USD
<BANKACCTFROM><BANKID>021000021<ACCTID>123456789012<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260301<DTEND>20260315
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260302120000[-5:EST]<TRNAMT>-42.17<FITID>2026030201<NAME>FICTIONAL GROCER #12<MEMO>POS PURCHASE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260305<TRNAMT>1,500.00<FITID>2026030501<NAME>ACME PAYROLL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260306000000.000<TRNAMT>-5.00<FITID>2026030601<MEMO>Only memo &amp; more</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>2345.67<DTASOF>20260315</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD</CURDEF>
<BANKACCTFROM><BANKID>1</BANKID><ACCTID>9876</ACCTID><ACCTTYPE>SAVINGS</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>XFER</TRNTYPE><DTPOSTED>20260310</DTPOSTED><TRNAMT>-200.00</TRNAMT><FITID>A1</FITID><NAME>Transfer to X</NAME></STMTTRN>
<STMTTRN><TRNTYPE>INT</TRNTYPE><DTPOSTED>20260311</DTPOSTED><TRNAMT>0.42</TRNAMT><FITID>A2</FITID><NAME>Interest</NAME></STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>-10.00</BALAMT><DTASOF>20260311</DTASOF></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const CARD = `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>USD
<CCACCTFROM><ACCTID>4111111111111111</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260320<TRNAMT>-19.99<FITID>c1<NAME>STREAMING CO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260321<TRNAMT>100.00<FITID>c2<NAME>PAYMENT THANK YOU</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>-250.10<DTASOF>20260321</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`

describe('parseOfx', () => {
  it('reads OFX 1.02 SGML', () => {
    const r = parseOfx(SGML)
    expect(r.format).toBe('sgml')
    const a = r.accounts[0]
    expect(a.kind).toBe('bank')
    expect(a.currency).toBe('USD')
    expect(a.masked).toBe('••9012')
    expect(a.masked).not.toContain('123456')
    expect(a.txs.map((t) => [t.date, t.amount, t.fitid])).toEqual([
      ['2026-03-02', -42.17, '2026030201'],
      ['2026-03-05', 1500, '2026030501'],
      ['2026-03-06', -5, '2026030601'],
    ])
    expect(a.txs[0].description).toBe('FICTIONAL GROCER #12')
    expect(a.txs[0].memo).toBe('POS PURCHASE')
    expect(a.txs[2].description).toBe('Only memo & more')
    expect(a.ledger).toEqual({ amount: 2345.67, date: '2026-03-15' })
    expect(r.warnings).toEqual([])
  })
  it('reads OFX 2 XML with currency and negative ledger', () => {
    const r = parseOfx(XML)
    expect(r.format).toBe('xml')
    expect(r.accounts[0].currency).toBe('CAD')
    expect(r.accounts[0].txs).toHaveLength(2)
    expect(r.accounts[0].txs[0].type).toBe('XFER')
    expect(r.accounts[0].ledger?.amount).toBe(-10)
  })
  it('reads credit card statements', () => {
    const a = parseOfx(CARD).accounts[0]
    expect(a.kind).toBe('card')
    expect(a.masked).toBe('••1111')
    expect(a.txs.map((t) => t.amount)).toEqual([-19.99, 100])
    expect(a.ledger?.amount).toBe(-250.1)
  })
  it('keeps complete rows from a truncated file and warns', () => {
    const cut = SGML.slice(0, SGML.indexOf('<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260306') + 60)
    const r = parseOfx(cut)
    expect(r.accounts[0].txs.map((t) => t.fitid)).toEqual(['2026030201', '2026030501'])
    expect(r.warnings.join(' ')).toMatch(/ends early/)
  })
  it('drops rows without a date or amount, with a warning', () => {
    const r = parseOfx('<OFX><STMTRS><STMTTRN><TRNAMT>-1<FITID>x</STMTTRN><STMTTRN><DTPOSTED>20260101<TRNAMT>-2<FITID>y</STMTTRN></STMTRS></OFX>')
    expect(r.accounts[0].txs).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/1 transaction had no readable/)
  })
  it('rejects non-OFX text', () => {
    expect(() => parseOfx('a,b,c\n1,2,3')).toThrow(/OFX/)
  })
})

describe('ofx helpers', () => {
  it.each([
    ['20260305', '2026-03-05'],
    ['20260305120000', '2026-03-05'],
    ['20260305120000.123[-5:EST]', '2026-03-05'],
    ['20260305000000[0:GMT]', '2026-03-05'],
    ['20261305', null],
    ['20260231', null],
    ['garbage', null],
    ['', null],
  ])('date %s', (raw, want) => expect(parseOfxDate(raw)).toBe(want))
  it.each([
    ['-12.50', -12.5],
    ['+3', 3],
    ['1,234.56', 1234.56],
    ['12,50', 12.5],
    ['(5.00)', -5],
    ['abc', null],
    ['', null],
  ])('amount %s', (raw, want) => expect(parseOfxAmount(raw)).toBe(want))
  it('masks all but the last 4', () => {
    expect(maskAccount('1234 5678 9012')).toBe('••9012')
    expect(maskAccount('')).toBe('')
  })
})

describe('FITID dedupe', () => {
  it('skips FITIDs already imported (per account) and repeated FITIDs inside one file', () => {
    const a = parseOfx(SGML).accounts[0]
    const rows = a.txs.map((t) => ({ date: t.date, amount: t.amount, description: t.description, fitid: ofxKey(a, t.fitid) }))
    const existing = [rows[0]]
    expect(planImport([...rows, rows[1]], existing)).toEqual(['dup', 'new', 'new', 'dup'])
    const other = ofxKey({ acctId: '999' }, a.txs[0].fitid)
    expect(planImport([{ ...rows[0], fitid: other }], existing)).toEqual(['new'])
  })
})
