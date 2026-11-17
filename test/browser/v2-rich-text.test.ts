// e-rich-text: a written text area holds the body's HTML; the script draws a toolbar over an editable
// body and writes every edit, cleaned, back to the text area with an input event.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineIcon } from '../../src/v2/icon.ts'
import { defineModal } from '../../src/v2/modal.ts'
import { cleanHtml, defineRichText, safeAddress } from '../../src/v2/rich-text.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.lang = 'en'
})

const delivery =
  '<form><e-rich-text label="Content"><textarea name="body">&lt;p&gt;Start your returns within &lt;b&gt;7 days&lt;/b&gt;.&lt;/p&gt;</textarea></e-rich-text></form>'

function mount(html = delivery) {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  const inputs: string[] = []
  holder.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) inputs.push(event.target.value)
  })
  defineIcon()
  defineButton()
  defineFields()
  defineModal()
  defineRichText()
  const editor = holder.querySelector('e-rich-text')!
  const body = editor.querySelector<HTMLElement>('[data-part="body"]')!
  const field = editor.querySelector('textarea')!
  const tool = (name: string) =>
    editor.querySelector<HTMLButtonElement>(`[data-part="tools"] > button[aria-label="${name}"]`)!
  return { editor, body, field, tool, inputs }
}

// Selects the word in the body's text, as a person's drag does.
function select(body: HTMLElement, word: string): void {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent!.indexOf(word)
    if (at < 0) continue
    body.focus()
    const range = document.createRange()
    range.setStart(node, at)
    range.setEnd(node, at + word.length)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
    return
  }
  throw new Error(`no ${word}`)
}

test('opening the editor writes nothing to its field and fires no input', () => {
  const { field, inputs, body } = mount()
  expect(field.value).toBe('<p>Start your returns within <b>7 days</b>.</p>')
  expect(body.innerHTML).toBe('<p>Start your returns within <strong>7 days</strong>.</p>')
  expect(inputs).toEqual([])
})

test('selecting "returns" and pressing Bold writes <strong>returns</strong>; undo writes the opening HTML back', async () => {
  const { field, body, tool, inputs } = mount()
  select(body, 'returns')
  tool('Bold').click()
  expect(field.value).toBe('<p>Start your <strong>returns</strong> within <strong>7 days</strong>.</p>')
  expect(inputs).toHaveLength(1)
  document.execCommand('undo')
  await expect.poll(() => field.value).toBe('<p>Start your returns within <b>7 days</b>.</p>')
  expect(inputs).toHaveLength(2)
})

test('with the caret inside a bold word, Bold reads pressed, and outside it does not', async () => {
  const { body, tool } = mount()
  select(body, '7 da')
  getSelection()!.collapseToEnd()
  await expect.poll(() => tool('Bold').getAttribute('aria-pressed')).toBe('true')
  select(body, 'Start')
  await expect.poll(() => tool('Bold').getAttribute('aria-pressed')).toBe('false')
})

test('Italic, Underline, Heading, List and Quote format the selection and read pressed there', async () => {
  const { field, body, tool } = mount()
  select(body, 'Start')
  tool('Italic').click()
  tool('Underline').click()
  expect(field.value).toContain('<em><u>Start</u></em>')
  tool('Heading').click()
  expect(field.value).toMatch(/^<h2>/)
  await expect.poll(() => tool('Heading').getAttribute('aria-pressed')).toBe('true')
  tool('Heading').click()
  expect(field.value).toMatch(/^<p>/)
  tool('List').click()
  expect(field.value).toMatch(/^<ul><li>/)
  tool('List').click()
  tool('Quote').click()
  expect(field.value).toMatch(/^<blockquote>/)
  await expect.poll(() => tool('Quote').getAttribute('aria-pressed')).toBe('true')
})

test('List on a typed line keeps the caret at its end, so Enter starts the next item', async () => {
  const { field, body, tool } = mount(
    '<form><e-rich-text label="Content"><textarea name="body"></textarea></e-rich-text></form>',
  )
  await userEvent.click(body)
  await userEvent.keyboard('Item A')
  tool('List').click()
  await userEvent.keyboard('{Enter}Item B')
  expect(field.value).toBe('<ul><li>Item A</li><li>Item B</li></ul>')
})

test('List with the caret at the start of a second line lists that line and keeps the caret there', async () => {
  const { field, body, tool } = mount(
    '<form><e-rich-text label="Content"><textarea name="body">&lt;p&gt;Intro&lt;/p&gt;&lt;p&gt;Item A&lt;/p&gt;</textarea></e-rich-text></form>',
  )
  select(body, 'Item A')
  getSelection()!.collapseToStart()
  tool('List').click()
  await userEvent.keyboard('New ')
  expect(field.value).toBe('<p>Intro</p><ul><li>New Item A</li></ul>')
})

test('pasting styled HTML keeps only the toolbar formatting', () => {
  const { field, body } = mount(
    '<form><e-rich-text label="Content"><textarea name="body"></textarea></e-rich-text></form>',
  )
  body.focus()
  const data = new DataTransfer()
  data.setData('text/html', '<p style="color:red"><span class="x">Hi</span> <b>there</b></p><script>alert(1)</script>')
  data.setData('text/plain', 'Hi there')
  body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  expect(field.value).toBe('<p>Hi <strong>there</strong></p>')
})

test('the cleaner keeps only safe links and images, and drops scripts, styles and handlers', () => {
  expect(
    cleanHtml('<p onclick="x()">A <a href="javascript:alert(1)">b</a> <a href=" https://x.com/a ">c</a></p>'),
  ).toBe('<p>A b <a href="https://x.com/a">c</a></p>')
  expect(cleanHtml('<img src="javascript:x" onerror="y"><img src="/a.jpg" alt="A">')).toBe(
    '<p><img src="/a.jpg" alt="A"></p>',
  )
  expect(cleanHtml('<style>p{}</style><h1>T</h1><div>x<div>y</div></div><ol><li>1</li></ol>')).toBe(
    '<h2>T</h2><p>x</p><p>y</p><ul><li>1</li></ul>',
  )
  expect(cleanHtml('<a href="//evil.example">x</a>')).toBe('<p>x</p>')
})

test('a /\\host, /\\/host or tab-split path is another site, and is refused', () => {
  for (const address of ['/\\evil.example', '/\\/evil.example', '/\t/evil.example', '/a\nb']) {
    expect(safeAddress(address), address).toBe(false)
  }
  expect(safeAddress('/pages/returns')).toBe(true)
  expect(cleanHtml('<a href="/\\evil.example">x</a>')).toBe('<p>x</p>')
})

test('a Google Docs paste, a <div> of paragraphs and a link around a block keep their paragraphs', () => {
  expect(
    cleanHtml(
      '<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span>A</span></p><p><span style="font-weight:700">B</span></p></b>',
    ),
  ).toBe('<p>A</p><p>B</p>')
  expect(cleanHtml('<div><p>A</p><p>B</p></div>')).toBe('<p>A</p><p>B</p>')
  expect(cleanHtml('<a href="/x"><div>A</div><div>B</div></a>')).toBe('<p>A</p><p>B</p>')
  expect(cleanHtml('<b>bold</b>')).toBe('<p><strong>bold</strong></p>')
})

test('cleaning cleaned HTML changes nothing', () => {
  for (const html of [
    '<ul><li>a<ul><li>b</li></ul></li></ul>',
    '<b><p>A</p><p>B</p></b>',
    '<a href="/x"><div>A</div></a>',
    '<p>x<div>y</div>z</p>',
    '<blockquote><p>q</p><ul><li>i</li></ul></blockquote>',
    '<li>loose</li>text<h3>h</h3>',
  ]) {
    const once = cleanHtml(html)
    expect(cleanHtml(once), html).toBe(once)
  }
})

test('a Show HTML round trip on an opening of nested lists and wrapped paragraphs writes nothing', () => {
  const { tool, inputs } = mount(
    '<form><e-rich-text label="Content"><textarea name="body">&lt;ul&gt;&lt;li&gt;a&lt;ul&gt;&lt;li&gt;b&lt;/li&gt;&lt;/ul&gt;&lt;/li&gt;&lt;/ul&gt;&lt;b&gt;&lt;p&gt;A&lt;/p&gt;&lt;/b&gt;</textarea></e-rich-text></form>',
  )
  tool('Show HTML').click()
  tool('Show HTML').click()
  expect(inputs).toEqual([])
})

test("an edit in the body takes the editor's error away", () => {
  const { editor, body, tool } = mount(
    delivery.replace(
      '<e-rich-text label="Content">',
      '<e-rich-text label="Content" error="Write at most 512 KB of content.">',
    ),
  )
  select(body, 'returns')
  tool('Bold').click()
  expect(editor.hasAttribute('error')).toBe(false)
})

test('a click on a link in the body puts the caret there and follows nothing', () => {
  const { body } = mount(
    '<form><e-rich-text label="Content"><textarea name="body">&lt;p&gt;See &lt;a href="/pages/returns"&gt;returns&lt;/a&gt;.&lt;/p&gt;</textarea></e-rich-text></form>',
  )
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  body.querySelector('a')!.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
})

test('Show HTML shows the HTML; a change there draws in the body on the way back', () => {
  const { editor, field, body, tool, inputs } = mount()
  tool('Show HTML').click()
  expect(field.checkVisibility()).toBe(true)
  expect(body.checkVisibility()).toBe(false)
  expect(tool('Bold').disabled).toBe(true)
  tool('Show HTML').click()
  // A round trip that changed nothing wrote nothing.
  expect(inputs).toEqual([])
  expect(field.value).toBe('<p>Start your returns within <b>7 days</b>.</p>')
  tool('Show HTML').click()
  // Typed, as a person types: the text area's own value, and its input.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
    field,
    '<p>Free delivery <i>inside Dhaka</i></p>',
  )
  field.dispatchEvent(new Event('input', { bubbles: true }))
  tool('Show HTML').click()
  expect(editor.querySelector<HTMLElement>('[data-part="box"]')!.dataset.mode).toBeUndefined()
  expect(body.innerHTML).toBe('<p>Free delivery <em>inside Dhaka</em></p>')
  expect(field.value).toBe('<p>Free delivery <em>inside Dhaka</em></p>')
})

test('a value written to the field, as Discard writes, draws in the body', () => {
  const { field, body } = mount()
  field.value = '<p>Back</p>'
  expect(body.innerHTML).toBe('<p>Back</p>')
})

test('the body is 240 px tall when empty and grows with its text; the label sits above the box', () => {
  const { editor, body } = mount(
    '<form><e-rich-text label="Content"><textarea name="body"></textarea></e-rich-text></form>',
  )
  expect(body.getBoundingClientRect().height).toBe(240)
  const box = editor.querySelector('[data-part="box"]')!.getBoundingClientRect()
  expect(editor.querySelector('[data-part="label"]')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.top)
  body.innerHTML = '<p>line</p>'.repeat(20)
  expect(body.getBoundingClientRect().height).toBeGreaterThan(240)
})

test.for(['en', 'bn'])(
  'at 360 px in %s the toolbar is one row of 44 px buttons that scrolls sideways',
  async (lang) => {
    document.documentElement.lang = lang
    await page.viewport(360, 800)
    const { editor } = mount()
    const tools = editor.querySelector<HTMLElement>('[data-part="tools"]')!
    const buttons = [...tools.querySelectorAll('button')].map((button) => button.getBoundingClientRect())
    expect(new Set(buttons.map((box) => box.top)).size).toBe(1)
    expect(buttons.every((box) => box.width === 44 && box.height === 44)).toBe(true)
    expect(getComputedStyle(tools).overflowX).toBe('auto')
    expect(tools.scrollWidth).toBeGreaterThan(tools.clientWidth)
    expect(editor.getBoundingClientRect().width).toBeLessThanOrEqual(360)
  },
)

test('no toolbar press submits the form', () => {
  const { editor, tool } = mount()
  let submits = 0
  editor.closest('form')!.addEventListener('submit', (event) => {
    submits++
    event.preventDefault()
  })
  for (const name of ['Bold', 'Italic', 'Underline', 'Heading', 'List', 'Quote', 'Show HTML', 'Show HTML'])
    tool(name).click()
  expect(submits).toBe(0)
})

const modal = (editor: Element) => editor.querySelector('e-modal')!
const modalButton = (editor: Element, name: string) =>
  [...modal(editor).querySelectorAll<HTMLButtonElement>('e-button > button')].find(
    (button) => button.textContent === name,
  )!
const modalField = (editor: Element, at = 0) => modal(editor).querySelectorAll('input')[at]!

test('Link with an address on "returns" wraps it in a link to that address', () => {
  const { editor, field, body, tool } = mount()
  select(body, 'returns')
  tool('Link').click()
  expect(modal(editor).querySelector('dialog')!.open).toBe(true)
  modalField(editor).value = 'https://rubelfashion.com/returns'
  modalButton(editor, 'Insert').click()
  expect(field.value).toContain('<a href="https://rubelfashion.com/returns">returns</a>')
  expect(modal(editor).querySelector('dialog')!.open).toBe(false)
})

test('on a link, Link shows its address to change, and Remove link unwraps it', () => {
  const { editor, field, body, tool } = mount(
    '<form><e-rich-text label="Content"><textarea name="body">&lt;p&gt;See &lt;a href="/pages/returns"&gt;returns&lt;/a&gt;.&lt;/p&gt;</textarea></e-rich-text></form>',
  )
  select(body, 'retu')
  getSelection()!.collapseToEnd()
  tool('Link').click()
  expect(modalField(editor).value).toBe('/pages/returns')
  modalField(editor).value = '/pages/refunds'
  modalButton(editor, 'Insert').click()
  expect(field.value).toBe('<p>See <a href="/pages/refunds">returns</a>.</p>')
  select(body, 'retu')
  tool('Link').click()
  modalButton(editor, 'Remove link').click()
  expect(field.value).toBe('<p>See returns.</p>')
})

test('a link address of javascript:alert(1) is refused under the field, and nothing is inserted', () => {
  const { editor, field, body, tool, inputs } = mount()
  select(body, 'returns')
  tool('Link').click()
  modalField(editor).value = 'javascript:alert(1)'
  modalButton(editor, 'Insert').click()
  expect(modal(editor).querySelector('e-text-field')!.getAttribute('error')).toBe(
    'Enter an address that starts with https:// or /',
  )
  expect(modal(editor).querySelector('dialog')!.open).toBe(true)
  expect(inputs).toEqual([])
  expect(field.value).not.toContain('<a')
  // Enter in the field is Insert, and submits no form.
  let submits = 0
  editor.closest('form')!.addEventListener('submit', (event) => {
    submits++
    event.preventDefault()
  })
  modalField(editor).value = 'https://rubelfashion.com/returns'
  modalField(editor).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  expect(submits).toBe(0)
  expect(field.value).toContain('<a href="https://rubelfashion.com/returns">returns</a>')
})

test('with no page answering, Image asks for an address and alt text, and Insert puts the image at the caret', () => {
  const { editor, field, body, tool } = mount()
  select(body, 'Start')
  getSelection()!.collapseToEnd()
  tool('Image').click()
  expect(modal(editor).getAttribute('heading')).toBe('Image')
  modalField(editor, 0).value = 'https://cdn.ebdfy.com/demo/jamdani.jpg'
  modalField(editor, 1).value = 'Jamdani saree'
  modalButton(editor, 'Insert').click()
  // Chromium keeps the space after an inserted image as a no-break space.
  expect(field.value).toMatch(
    /^<p>Start<img src="https:\/\/cdn\.ebdfy\.com\/demo\/jamdani\.jpg" alt="Jamdani saree">(&nbsp;| )your returns/,
  )
})

test('a page that answers e-rich-text-image puts its own image in, and the editor asks nothing', () => {
  const { editor, field, body, tool } = mount()
  editor.addEventListener('e-rich-text-image', (event) => {
    event.preventDefault()
    ;(event as CustomEvent).detail.insert({ src: '/files/jamdani-panjabi-white.jpg', alt: 'White jamdani panjabi' })
  })
  select(body, 'Start')
  getSelection()!.collapseToEnd()
  tool('Image').click()
  expect(editor.querySelector('e-modal')).toBeNull()
  expect(field.value).toContain('<img src="/files/jamdani-panjabi-white.jpg" alt="White jamdani panjabi">')
})
