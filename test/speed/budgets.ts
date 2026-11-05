// The speed budgets and the report the speed check prints: each number beside its
// budget, so a red run says by how much.
export const kb = 1000

export const budgets = {
  css: 25 * kb,
  js: 30 * kb,
  firstScreen: 120 * kb,
  lcp: 2000,
  cls: 0.02,
  inp: 150,
}

export interface Line {
  what: string
  value: number
  budget: number
  unit: 'bytes' | 'ms' | ''
}

const shown = (value: number, unit: Line['unit']) =>
  unit === 'bytes' ? `${(value / kb).toFixed(1)} KB` : unit === 'ms' ? `${Math.round(value)} ms` : value.toFixed(3)

export function report(lines: Line[]): string {
  return lines
    .map(({ what, value, budget, unit }) => {
      // A line with no budget of its own is a part of the line above it.
      if (budget === Number.POSITIVE_INFINITY) return `     ${what.padEnd(48)} ${shown(value, unit).padStart(10)}`
      const mark = value <= budget ? 'ok  ' : 'OVER'
      return `${mark} ${what.padEnd(48)} ${shown(value, unit).padStart(10)}  budget ${shown(budget, unit)}`
    })
    .join('\n')
}

export const over = (lines: Line[]) => lines.filter(({ value, budget }) => value > budget)
