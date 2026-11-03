import { expect, test } from 'vitest'

// Each case is a fresh frame, so a font file one case loaded never shows up in another's requests.
async function open(lang: string, text: string): Promise<Document> {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'width:360px;height:200px;border:0'
  frame.src = `/test/browser/fixtures/fonts.html?${new URLSearchParams({ lang, text })}`
  document.body.append(frame)
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  const doc = frame.contentDocument!
  const button = doc.querySelector('eb-button') as HTMLElement & { updateComplete: Promise<unknown> }
  await button.updateComplete
  button.getBoundingClientRect()
  await doc.fonts.ready
  return doc
}

function fontFiles(doc: Document): string[] {
  return doc
    .defaultView!.performance.getEntriesByType('resource')
    .map((entry) => entry.name.split('/').pop() ?? '')
    .filter((name) => name.endsWith('.woff2'))
}

// The families whose faces the page asked for, which no browser cache can hide.
function requestedFamilies(doc: Document): string[] {
  return [...new Set([...doc.fonts].filter((face) => face.status !== 'unloaded').map((face) => face.family))]
}

test('an English button requests a Geist file and no Noto Sans Bengali file', async () => {
  const doc = await open('en', 'Add order')
  expect(fontFiles(doc)).toEqual(['geist-latin-wght-normal.woff2'])
  expect(requestedFamilies(doc)).toEqual(['Geist'])
})

test('a Bangla button requests only the Bangla file, not Geist for its spaces and comma', async () => {
  const doc = await open('bn', 'অর্ডার যোগ করুন, দয়া করে।')
  expect(fontFiles(doc)).toEqual(['noto-sans-bengali-bangla.woff2'])
  expect(requestedFamilies(doc)).toEqual(['Noto Sans Bengali'])
})

test('a Bangla button draws its order and phone numbers in Geist', async () => {
  const doc = await open('bn', 'অর্ডার #1024, ফোন 01707071591')
  expect(fontFiles(doc).toSorted()).toEqual(['geist-latin-wght-normal.woff2', 'noto-sans-bengali-bangla.woff2'])
  const geist = [...doc.fonts].filter((face) => face.family === 'Geist Letters' && face.status === 'loaded')
  expect(geist).toHaveLength(1)
})

test('an English taka price requests the taka file and not the Bangla file', async () => {
  const doc = await open('en', '৳1,25,000')
  expect(fontFiles(doc)).toContain('noto-sans-bengali-taka.woff2')
  expect(fontFiles(doc)).not.toContain('noto-sans-bengali-bangla.woff2')
})

test('latin text is drawn in Geist and Bangla text in Noto Sans Bengali', async () => {
  const en = await open('en', 'Add order')
  const geist = [...en.fonts].filter((face) => face.family === 'Geist' && face.status === 'loaded')
  expect(geist).toHaveLength(1)
  expect(en.fonts.check('14px Geist', 'Add order')).toBe(true)

  const bn = await open('bn', 'অর্ডার যোগ করুন')
  const noto = [...bn.fonts].filter((face) => face.family === 'Noto Sans Bengali' && face.status === 'loaded')
  expect(noto).toHaveLength(1)
  expect(bn.fonts.check("14px 'Noto Sans Bengali'", 'অর্ডার যোগ করুন')).toBe(true)
})
