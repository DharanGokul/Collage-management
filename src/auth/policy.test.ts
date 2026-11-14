import { describe, expect, it } from 'vitest'
import { checkPassword, formatSeconds, maskEmail } from './policy'

describe('password policy', () => {
  it('rejects short, single-case, numberless and common passwords', () => {
    for (const pw of ['Ab1', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumbersHere', 'Password123', 'demo1234']) {
      expect(checkPassword(pw).ok, pw).toBe(false)
    }
  })

  it('accepts a long mixed password', () => {
    expect(checkPassword('Campus#2026x').ok).toBe(true)
  })

  it('rejects passwords containing personal details', () => {
    expect(checkPassword('Ravi.Shankar#2026', ['ravi.shankar']).ok).toBe(false)
  })

  it('scores stronger passwords higher', () => {
    expect(checkPassword('').score).toBe(0)
    expect(checkPassword('Campus#2026x!long').score).toBeGreaterThan(checkPassword('abcdefgh').score)
  })
})

describe('display helpers', () => {
  it('masks the local part of an email', () => {
    expect(maskEmail('ravi.shankar@college.edu')).toMatch(/^r•+@college\.edu$/)
    expect(maskEmail('nothing')).toBe('nothing')
  })

  it('formats countdowns', () => {
    expect(formatSeconds(45)).toBe('45s')
    expect(formatSeconds(300)).toBe('5m 00s')
    expect(formatSeconds(75)).toBe('1m 15s')
  })
})
