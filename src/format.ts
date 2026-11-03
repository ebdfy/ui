// Numbers for people in Bangladesh: lakh grouping in both languages, Bangla digits for Bangla.
// Phone, order, tracking and discount numbers are identifiers and stay in Latin digits.

export type Lang = 'bn' | 'en'

export function pageLang(): Lang {
  return document.documentElement.lang.startsWith('bn') ? 'bn' : 'en'
}

const grouped = {
  bn: new Intl.NumberFormat('bn-IN', { maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }),
}

export function digits(value: number, lang: Lang = pageLang()): string {
  return grouped[lang].format(value)
}

export function taka(amount: number, lang: Lang = pageLang()): string {
  return `৳${digits(amount, lang)}`
}

// Bangla digits are U+09E6 to U+09EF, in order, so each maps to its Latin digit by offset.
export function phone(number: string): string {
  return number.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
}
