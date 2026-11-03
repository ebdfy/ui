import { expect, test } from 'vitest'

import { digits, phone, taka } from '../../src/format.ts'

test('taka puts the sign first with lakh grouping, in the digits of the language', () => {
  expect(taka(125000, 'bn')).toBe('৳১,২৫,০০০')
  expect(taka(125000, 'en')).toBe('৳1,25,000')
})

test('digits follow the language with lakh grouping', () => {
  expect(digits(1234567, 'bn')).toBe('১২,৩৪,৫৬৭')
  expect(digits(1234567, 'en')).toBe('12,34,567')
})

test('a phone number reads in Latin digits, even when typed in Bangla digits', () => {
  expect(phone('01707071591')).toBe('01707071591')
  expect(phone('০১৭০৭০৭১৫৯১')).toBe('01707071591')
})

test('the formatters read the page language when none is given', () => {
  document.documentElement.lang = 'bn'
  expect(taka(125000)).toBe('৳১,২৫,০০০')
  document.documentElement.lang = 'en'
  expect(taka(125000)).toBe('৳1,25,000')
})
