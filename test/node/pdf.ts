// Reads what the print tests need from a PDF that Chromium printed: each page's size in points, and
// how far below the paper's top edge its highest line of text starts. Chromium writes each page and
// its content stream as plain numbered objects, the stream compressed with Flate.
import { inflateSync } from 'node:zlib'

export interface PrintedPage {
  width: number
  height: number
  // The distance from the paper's top edge to the top of the highest text on the page, in mm.
  textTop: number
}

const mm = (points: number) => (points * 25.4) / 72

type Matrix = [number, number, number, number, number, number]
const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]
const identity: Matrix = [1, 0, 0, 1, 0, 0]

// The operators and number operands of a content stream; strings, names and arrays are skipped.
function* operations(content: string): Generator<[string, number[]]> {
  const token =
    /\((?:\\.|[^\\)])*\)|<<|>>|<[0-9A-Fa-f\s]*>|\[|\]|\/[^\s/<>[\]()]+|[-+]?(?:\d+\.?\d*|\.\d+)|[A-Za-z'"*]+/g
  let operands: number[] = []
  for (const [text] of content.matchAll(token)) {
    if (/^[-+.\d]/.test(text)) operands.push(Number(text))
    else if (/^[A-Za-z'"*]/.test(text)) {
      yield [text, operands]
      operands = []
    }
  }
}

// The top of the highest text a content stream draws, in points from the page's bottom edge.
function highestText(content: string): number {
  let ctm = identity
  const saved: Matrix[] = []
  let line = identity
  let size = 0
  let top = Number.NEGATIVE_INFINITY
  for (const [op, n] of operations(content)) {
    if (op === 'q') saved.push(ctm)
    else if (op === 'Q') ctm = saved.pop() ?? identity
    else if (op === 'cm') ctm = times(n as Matrix, ctm)
    else if (op === 'BT') line = identity
    else if (op === 'Tf') size = n[1] ?? 0
    else if (op === 'Tm') line = n as Matrix
    else if (op === 'Td' || op === 'TD') line = times([1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0], line)
    else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
      const m = times(line, ctm)
      // The baseline's point and the point a font size above it, as the glyphs rise.
      top = Math.max(top, m[5], size * m[3] + m[5])
    }
  }
  return top
}

export function printedPages(pdf: Buffer): PrintedPage[] {
  const text = pdf.toString('latin1')
  const objects = new Map<string, string>()
  for (const [, id, body] of text.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) objects.set(id!, body!)
  const stream = (id: string) => {
    const body = objects.get(id) ?? ''
    const start = body.indexOf('stream') + 'stream'.length
    const data = body.slice(start, body.lastIndexOf('endstream')).replace(/^\r?\n/, '')
    return inflateSync(Buffer.from(data, 'latin1')).toString('latin1')
  }
  const refs = (list: string) => [...list.matchAll(/(\d+) 0 R/g)].map((match) => match[1]!)
  const root = /\/Root (\d+) 0 R/.exec(text)?.[1] ?? ''
  const pagesOf = (id: string): string[] => {
    const body = objects.get(id) ?? ''
    if (/\/Type\s*\/Page\b(?!s)/.test(body)) return [id]
    return refs(/\/Kids\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '').flatMap(pagesOf)
  }
  const top = /\/Pages (\d+) 0 R/.exec(objects.get(root) ?? '')?.[1] ?? ''
  return pagesOf(top).map((id) => {
    const body = objects.get(id) ?? ''
    const [, , width = 0, height = 0] = (/\/MediaBox\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '')
      .trim()
      .split(/\s+/)
      .map(Number)
    const contents = refs(/\/Contents\s*(\[[^\]]*\]|\d+ 0 R)/.exec(body)?.[1] ?? '')
    const highest = Math.max(...contents.map((content) => highestText(stream(content))))
    return { width, height, textTop: mm(height - highest) }
  })
}
