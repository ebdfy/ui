// Each docs example shows code printed from its demo's markup: the code drops what only the docs
// read, reads cleanly, and renders to the demo itself. No dev server: framePage is a pure function.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { codeOf } from '../../scripts/docs-examples.ts'
import { framePage, pathOf } from '../../scripts/docs.ts'

let browser: Browser

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(() => browser?.close())

const ui = fileURLToPath(new URL('../../site/ui/', import.meta.url))
const files = readdirSync(ui, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.html') && readFileSync(`${ui}${file}`, 'utf8').includes('<docs-example'),
)

test('the code drops the docs-only attributes and puts one attribute per line on a long tag', () => {
  expect(codeOf('<eb-button variant="primary" data-en="Save" data-bn="সেভ করুন">Save</eb-button>')).toBe(
    '<eb-button variant="primary">Save</eb-button>',
  )
  expect(
    codeOf(`<eb-text-field
          label="Delivery address"
          help="As it shows on the parcel"
          data-label-en="Delivery address"
          data-label-bn="ডেলিভারির ঠিকানা"
          data-state="default"
          required
        ></eb-text-field>`),
  ).toBe(
    [
      '<eb-text-field',
      '  label="Delivery address"',
      '  help="As it shows on the parcel"',
      '  required',
      '></eb-text-field>',
    ].join('\n'),
  )
  expect(
    codeOf(`<eb-button variant="primary"
            ><eb-icon slot="icon" name="plus"></eb-icon
            ><span data-en="Add order" data-bn="অর্ডার যোগ করুন">Add order</span></eb-button
          >`),
  ).toBe(
    [
      '<eb-button variant="primary">',
      '  <eb-icon slot="icon" name="plus"></eb-icon>',
      '  <span>Add order</span>',
      '</eb-button>',
    ].join('\n'),
  )
})

test('a value that holds a double quote keeps its single quotes in the code', () => {
  expect(codeOf(`<eb-text-field label='Say "hi"'></eb-text-field>`)).toBe(
    `<eb-text-field label='Say "hi"'></eb-text-field>`,
  )
})

test('the site has pages with framed examples', () => {
  expect(files).toContain('components/button.html')
})

// The markup as the browser builds it, written out the same way every time: each element as its
// tag, its attributes but the docs-only ones, sorted, and its children; text as its words.
// Whitespace between tags is layout, not content.
function rendered(markup: string): string {
  const docsOnly = /^data-(en|bn|taka|phone|state)$|^data-.+-(en|bn)$/
  const write = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!(node instanceof Element)) return ''
    const attrs = [...node.attributes]
      .filter((attr) => !docsOnly.test(attr.name))
      .map((attr) => ` ${attr.name}="${attr.value}"`)
      .sort()
      .join('')
    return `<${node.localName}${attrs}>${[...node.childNodes].map(write).join('')}</${node.localName}>`
  }
  const template = document.createElement('template')
  template.innerHTML = markup
  return [...template.content.childNodes].map(write).join('')
}

for (const file of files) {
  test(`every example on ${pathOf(file)} shows code that renders to its demo`, async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const served = framePage(readFileSync(`${ui}${file}`, 'utf8'), pathOf(file))
    // The page as served, parsed but not run: no element is upgraded, so the demo is its markup.
    const examples = await page.evaluate((html) => {
      const template = document.createElement('template')
      template.innerHTML = html
      return [...template.content.querySelectorAll('figure.example')].map((figure) => ({
        caption: figure.querySelector('figcaption')?.textContent ?? '',
        demo: figure.querySelector('.demo')?.innerHTML ?? '',
        code: figure.querySelector('pre code')?.textContent ?? '',
      }))
    }, served)
    const pairs = []
    for (const { caption, demo, code } of examples) {
      pairs.push({
        caption,
        demo: await page.evaluate(rendered, demo),
        code: await page.evaluate(rendered, code),
      })
    }
    expect(pairs.length).toBeGreaterThan(0)
    for (const { caption, demo, code } of pairs) expect(code, caption ?? '').toBe(demo)
    await context.close()
  })
}

test('every code block on every docs page has a Copy button beside it', () => {
  const bare = readdirSync(ui, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html') && file !== 'playground.html')
    .flatMap((file) => {
      const served = framePage(readFileSync(`${ui}${file}`, 'utf8'), pathOf(file))
      const blocks = served.match(/<pre[\s>]/g)?.length ?? 0
      const copied = served.match(/<\/pre><button type="button" class="copy">Copy<\/button>/g)?.length ?? 0
      return blocks === copied ? [] : [`${file}: ${blocks - copied} of ${blocks} without Copy`]
    })
  expect(bare).toEqual([])
})

// The header's language switch rewrites an example's words and properties from its data-en and
// data-<property>-en, after the code was printed from the markup. So the markup must already say in
// English what the switch would set, or the demo shows something the code does not.
test('every example already holds the English its language switch would set', async () => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const drift: string[] = []
  for (const file of files) {
    const served = framePage(readFileSync(`${ui}${file}`, 'utf8'), pathOf(file))
    const found = await page.evaluate((html) => {
      const template = document.createElement('template')
      template.innerHTML = html
      const problems: string[] = []
      for (const el of template.content.querySelectorAll('.demo *')) {
        const en = el.getAttribute('data-en')
        if (en !== null && el.textContent?.trim() !== en.trim())
          problems.push(`<${el.localName}> says "${el.textContent?.trim()}", data-en "${en}"`)
        for (const attr of el.attributes) {
          const property = /^data-(.+)-en$/.exec(attr.name)?.[1]
          if (property && el.getAttribute(property) !== attr.value)
            problems.push(`<${el.localName}> ${property}="${el.getAttribute(property)}", ${attr.name}="${attr.value}"`)
        }
      }
      return problems
    }, served)
    drift.push(...found.map((problem) => `${file}: ${problem}`))
  }
  await context.close()
  expect(drift).toEqual([])
})
