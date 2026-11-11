import { describe, expect, it } from 'vitest'
import { doneMessage } from './winCopy'

describe('doneMessage', () => {
  it('names the task and the count', () => {
    expect(doneMessage('renew car registration', 4)).toMatch(/^Done: renew car registration\. .*4.*\.$/)
  })
  it('handles the first completion', () => {
    expect(doneMessage('x', 1)).toBe('Done: x. First one on the board today.')
  })
  it('does not repeat the closing line on consecutive counts', () => {
    for (let n = 2; n < 30; n++) expect(doneMessage('t', n).replace(String(n), '#')).not.toBe(doneMessage('t', n + 1).replace(String(n + 1), '#'))
  })
})
