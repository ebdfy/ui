import type { Lang } from './format.ts'

// The language of an element's text: its own lang, or the nearest one around it.
export function langOf(el: Element): Lang {
  return el.closest('[lang]')?.getAttribute('lang')?.startsWith('bn') ? 'bn' : 'en'
}
