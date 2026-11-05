// The chrome's rules v2-host.js shares: limits that count letters, and its words in both languages.
import { expect, test } from 'vitest'

import { answerSeconds, cut, cutTitle, titleLimit, toastSeconds, words } from '../../src/host-rules.ts'

test('a title past 60 letters is cut with an ellipsis, a Bangla conjunct never split', () => {
  expect(cutTitle('a'.repeat(titleLimit))).toBe('a'.repeat(60))
  expect(cutTitle('a'.repeat(61))).toBe(`${'a'.repeat(59)}…`)
  // ক্ষ is one letter of three code points.
  expect(cut('ক্ষক্ষক্ষ', 2)).toBe('ক্ষ…')
})

test('an app has 15 s to answer and a toast stays 5 s', () => {
  expect([answerSeconds, toastSeconds]).toEqual([15, 5])
  expect(words.en.stalled).toBe("This app isn't responding")
  expect(Object.keys(words.bn).sort()).toEqual(Object.keys(words.en).sort())
})
