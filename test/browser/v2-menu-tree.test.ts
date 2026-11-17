// e-menu-tree: a menu's items as a tree of up to 3 levels. Rows move by keyboard and drag, a fourth
// level or a drop into an item's own children is refused, and the field holds the API's items.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineIcon } from '../../src/v2/icon.ts'
import { defineMenuTree } from '../../src/v2/menu-tree.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.lang = 'en'
})

const main = `<form><e-menu-tree name="items" label="Menu items"
  ><e-menu-tree-item label="Home" url="/"></e-menu-tree-item
  ><e-menu-tree-item label="Men" resource-id="gid://ebdfy/Collection/11"
    ><e-menu-tree-item label="Men's panjabi" resource-id="gid://ebdfy/Collection/12"></e-menu-tree-item
  ></e-menu-tree-item
  ><e-menu-tree-item label="Women" resource-id="gid://ebdfy/Collection/21"
    ><e-menu-tree-item label="Sarees under ৳2,000" resource-id="gid://ebdfy/Collection/22"></e-menu-tree-item
    ><e-menu-tree-item label="Silk hijab" resource-id="gid://ebdfy/Collection/23"></e-menu-tree-item
  ></e-menu-tree-item
  ><e-menu-tree-item label="Kids" resource-id="gid://ebdfy/Collection/31"></e-menu-tree-item
  ><e-menu-tree-item label="Eid 2026" resource-id="gid://ebdfy/Collection/41"></e-menu-tree-item
  ><e-menu-tree-item label="About us" url="/pages/about"></e-menu-tree-item
></e-menu-tree></form>`

function mount(html = main) {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  const inputs: string[] = []
  holder.addEventListener('input', (event) => inputs.push((event.target as HTMLInputElement).value))
  defineIcon()
  defineMenuTree()
  const tree = holder.querySelector('e-menu-tree')!
  const field = holder.querySelector<HTMLInputElement>('input[name="items"]')!
  const item = (label: string) =>
    [...tree.querySelectorAll('e-menu-tree-item')].find((one) => one.getAttribute('label') === label)!
  const handle = (label: string) =>
    item(label).querySelector<HTMLButtonElement>(':scope > [data-part="row"] > [data-part="handle"]')!
  return { tree, field, item, handle, inputs }
}

// The tree as indented titles, one per row.
const outline = (tree: Element) =>
  [...tree.querySelectorAll('e-menu-tree-item')].map((item) => {
    let depth = 0
    for (let at = item.parentElement; at?.localName === 'e-menu-tree-item'; at = at.parentElement) depth++
    return `${'  '.repeat(depth)}${item.getAttribute('label')}`
  })

const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

test('the field holds the items as the API takes them, and opening fires no input', () => {
  const { field, inputs } = mount()
  const items = JSON.parse(field.value)
  expect(items[0]).toEqual({ title: 'Home', url: '/', items: [] })
  expect(
    field.value.startsWith(
      '[{"title":"Home","url":"/","items":[]},{"title":"Men","resourceId":"gid://ebdfy/Collection/11","items":[{"title":"Men\'s panjabi"',
    ),
  ).toBe(true)
  expect(items.map((one: { title: string }) => one.title)).toEqual([
    'Home',
    'Men',
    'Women',
    'Kids',
    'Eid 2026',
    'About us',
  ])
  expect(inputs).toEqual([])
})

test('each row is a handle, the label, Edit and Delete, and each group ends in its add', () => {
  const { tree, item } = mount()
  const row = item('Men').querySelector(':scope > [data-part="row"]')!
  expect([...row.children].map((part) => part.getAttribute('aria-label') ?? part.textContent)).toEqual([
    'Move Men',
    'Men',
    'Edit Men',
    'Delete Men',
  ])
  expect([...tree.querySelectorAll('[data-part="add"]')].map((add) => add.textContent)).toEqual([
    'Add menu item to Men',
    'Add menu item to Women',
    'Add menu item',
  ])
  // Children sit indented under their item.
  const child = item("Men's panjabi").querySelector('[data-part="label"]')!.getBoundingClientRect()
  expect(child.left).toBeGreaterThan(row.querySelector('[data-part="label"]')!.getBoundingClientRect().left + 20)
})

test('Up and Down move an item among its siblings, and the field follows once per move', () => {
  const { tree, field, handle, inputs } = mount()
  const before = field.value
  key(handle('Kids'), 'ArrowUp')
  expect(outline(tree).slice(0, 7)).toEqual([
    'Home',
    'Men',
    "  Men's panjabi",
    'Kids',
    'Women',
    '  Sarees under ৳2,000',
    '  Silk hijab',
  ])
  expect(JSON.parse(field.value)[2].title).toBe('Kids')
  expect(inputs).toHaveLength(1)
  expect(document.activeElement).toBe(handle('Kids'))
  key(handle('Kids'), 'ArrowDown')
  // Back where it was, the field is byte for byte as it opened.
  expect(field.value).toBe(before)
})

test('Right puts Silk hijab under Sarees under ৳2,000, and Left lifts it back', () => {
  const { tree, field, handle } = mount()
  const before = field.value
  key(handle('Silk hijab'), 'ArrowRight')
  expect(outline(tree).slice(3, 6)).toEqual(['Women', '  Sarees under ৳2,000', '    Silk hijab'])
  key(handle('Silk hijab'), 'ArrowLeft')
  expect(outline(tree).slice(3, 6)).toEqual(['Women', '  Sarees under ৳2,000', '  Silk hijab'])
  expect(field.value).toBe(before)
})

test('a move that would make a fourth level leaves the tree as it was, and the row says "Menus go 3 levels deep"', () => {
  const { tree, field, item, handle, inputs } = mount()
  key(handle('Silk hijab'), 'ArrowRight')
  key(handle('Men'), 'ArrowDown')
  key(handle('Men'), 'ArrowRight')
  expect(outline(tree).slice(1, 7)).toEqual([
    'Women',
    '  Sarees under ৳2,000',
    '    Silk hijab',
    '  Men',
    "    Men's panjabi",
    'Kids',
  ])
  const [shape, value] = [outline(tree), field.value]
  inputs.length = 0
  // Men holds a child, so under Sarees, itself at the second level, it would reach a fourth.
  key(handle('Men'), 'ArrowRight')
  expect([outline(tree), field.value]).toEqual([shape, value])
  expect(inputs).toEqual([])
  expect(item('Men').querySelector(':scope > [data-part="row"] [data-part="note"]')!.textContent).toBe(
    'Menus go 3 levels deep',
  )
  // The next move that works clears it.
  key(handle('Men'), 'ArrowUp')
  expect(item('Men').querySelector('[data-part="note"]')).toBeNull()
})

test('Delete removes the item and its children, and focus moves to the next row', () => {
  const { tree, field, item } = mount()
  item('Women').querySelector<HTMLButtonElement>(':scope > [data-part="row"] > [data-part="delete"]')!.click()
  expect(outline(tree)).toEqual(['Home', 'Men', "  Men's panjabi", 'Kids', 'Eid 2026', 'About us'])
  expect(JSON.parse(field.value)).toHaveLength(5)
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Kids')
})

test('a value written to the field, as Discard writes, draws those items again', () => {
  const { tree, field, handle } = mount()
  const saved = field.value
  key(handle('Kids'), 'ArrowUp')
  handle('Home').closest('e-menu-tree-item')!.querySelector<HTMLButtonElement>('[data-part="delete"]')!.click()
  field.value = saved
  expect(outline(tree)).toEqual([
    'Home',
    'Men',
    "  Men's panjabi",
    'Women',
    '  Sarees under ৳2,000',
    '  Silk hijab',
    'Kids',
    'Eid 2026',
    'About us',
  ])
  expect(field.value).toBe(saved)
})

test('Add asks the page with the parent, and its done puts the item last under it', () => {
  const { tree, field, item, inputs } = mount()
  let asked: { parent: Element | null; done: (item: object) => void } | null = null
  tree.addEventListener('e-menu-tree-add', (event) => (asked = (event as CustomEvent).detail))
  const add = [...tree.querySelectorAll<HTMLButtonElement>('[data-part="add"]')].find(
    (one) => one.textContent === 'Add menu item to Women',
  )!
  add.click()
  expect(asked!.parent).toBe(item('Women'))
  asked!.done({ title: 'Cotton tant saree', resourceId: 'gid://ebdfy/Collection/24' })
  expect(outline(tree).slice(3, 7)).toEqual(['Women', '  Sarees under ৳2,000', '  Silk hijab', '  Cotton tant saree'])
  expect(JSON.parse(field.value)[2].items[2]).toEqual({
    title: 'Cotton tant saree',
    resourceId: 'gid://ebdfy/Collection/24',
    items: [],
  })
  expect(inputs).toHaveLength(1)
})

test('Edit asks the page with the item, and its done changes it', () => {
  const { tree, field, item } = mount()
  tree.addEventListener('e-menu-tree-edit', (event) => {
    const { item: asked, done } = (event as CustomEvent).detail
    expect(asked).toEqual({ title: 'About us', url: '/pages/about' })
    done({ title: 'Our story', url: '/pages/story' })
  })
  item('About us').querySelector<HTMLButtonElement>('[data-part="edit"]')!.click()
  expect(JSON.parse(field.value).at(-1)).toEqual({ title: 'Our story', url: '/pages/story', items: [] })
  expect(item('Our story').querySelector('[data-part="handle"]')!.getAttribute('aria-label')).toBe('Move Our story')
})

// Drags a handle to a point on another row, as a mouse or finger does.
async function drag(handle: Element, row: Element, at: number) {
  const from = handle.getBoundingClientRect()
  const to = row.getBoundingClientRect()
  const point = (box: DOMRect, y: number) => ({ clientX: box.left + box.width / 2, clientY: box.top + box.height * y })
  const fire = (type: string, x: { clientX: number; clientY: number }, target: Element) =>
    target.dispatchEvent(
      new PointerEvent(type, { ...x, bubbles: true, cancelable: true, pointerId: 1, button: 0, isPrimary: true }),
    )
  fire('pointerdown', point(from, 0.5), handle)
  fire('pointermove', point(to, at), handle)
  fire('pointerup', point(to, at), handle)
}

const row = (item: Element) => item.querySelector(':scope > [data-part="row"]')!

test('dragging Kids onto the top of Women puts it above Women', async () => {
  const { tree, item, handle } = mount()
  await drag(handle('Kids'), row(item('Women')), 0.1)
  expect(outline(tree).slice(0, 5)).toEqual(['Home', 'Men', "  Men's panjabi", 'Kids', 'Women'])
})

test('dragging into the middle of a row puts the item under it, and its children go with it', async () => {
  const { tree, item, handle } = mount()
  await drag(handle('Men'), row(item('Kids')), 0.5)
  expect(outline(tree).slice(-5)).toEqual(['Kids', '  Men', "    Men's panjabi", 'Eid 2026', 'About us'])
})

test('dropping Women onto its own child Silk hijab leaves the tree as it was', async () => {
  const { tree, field, item, handle, inputs } = mount()
  const before = [outline(tree), field.value]
  await drag(handle('Women'), row(item('Silk hijab')), 0.5)
  await drag(handle('Women'), row(item('Silk hijab')), 0.9)
  expect([outline(tree), field.value]).toEqual(before)
  expect(inputs).toEqual([])
})

test('a drag that would make a fourth level is refused with the note', async () => {
  const { tree, item, handle } = mount()
  const before = outline(tree)
  await drag(handle('Men'), row(item('Silk hijab')), 0.5)
  expect(outline(tree)).toEqual(before)
  expect(item('Men').querySelector('[data-part="note"]')!.textContent).toBe('Menus go 3 levels deep')
})

test.for(['en', 'bn'])(
  'at 360 px in %s the handle, Edit and Delete are 44 px and a long label wraps clear of them',
  async (lang) => {
    document.documentElement.lang = lang
    await page.viewport(360, 800)
    const { item } = mount(
      main.replace(
        'label="Eid 2026"',
        'label="Eid 2026 collection of jamdani panjabi, cotton saree and silk hijab for the whole family"',
      ),
    )
    const long = row(item('Eid 2026 collection of jamdani panjabi, cotton saree and silk hijab for the whole family'))
    const parts = [...long.querySelectorAll(':scope > button')].map((button) => button.getBoundingClientRect())
    expect(parts.map((box) => [box.width, box.height])).toEqual([
      [44, 44],
      [44, 44],
      [44, 44],
    ])
    const label = long.querySelector('[data-part="label"]')!.getBoundingClientRect()
    expect(label.left).toBeGreaterThanOrEqual(parts[0]!.right)
    expect(label.right).toBeLessThanOrEqual(parts[1]!.left)
    expect(label.height).toBeGreaterThan(20)
    expect(long.getBoundingClientRect().right).toBeLessThanOrEqual(360)
    if (lang === 'bn') expect(long.querySelector('[data-part="handle"]')!.getAttribute('aria-label')).toMatch(/সরান$/)
  },
)

test('no button of the tree submits its form', () => {
  const { tree } = mount()
  let submits = 0
  tree.closest('form')!.addEventListener('submit', (event) => {
    submits++
    event.preventDefault()
  })
  for (const button of tree.querySelectorAll<HTMLButtonElement>('[data-part="edit"], [data-part="add"]')) button.click()
  tree.querySelector<HTMLButtonElement>('[data-part="delete"]')!.click()
  expect(submits).toBe(0)
})
