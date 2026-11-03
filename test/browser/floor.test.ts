import { expect, test } from 'vitest'

const heading = 'Update your browser to use ebdfy'
const playStore = 'https://play.google.com/store/apps/details?id=com.android.chrome'

// Each fixture is a fresh frame, so it can drop a browser feature or claim an old Chrome before
// v1.js loads.
async function open(query: string): Promise<Document> {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'width:360px;height:600px;border:0'
  frame.src = `/test/browser/fixtures/floor.html${query}`
  document.body.append(frame)
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  // A module script has run by the load event.
  return frame.contentDocument!
}

test('a browser without declarative shadow DOM gets the update page and none of the original content', async () => {
  const doc = await open('?template')
  expect('shadowRootMode' in (doc.defaultView as unknown as typeof globalThis).HTMLTemplateElement.prototype).toBe(
    false,
  )
  expect(doc.querySelector('h1')!.textContent).toBe(heading)
  expect(doc.querySelector('a')!.href).toBe(playStore)
  expect(doc.body.children).toHaveLength(1)
  expect(doc.querySelector('eb-card, eb-button')).toBeNull()
})

test('a page opened with ?floor=old gets the update page', async () => {
  const doc = await open('?floor=old')
  expect(doc.querySelector('h1')!.textContent).toBe(heading)
  expect(doc.querySelector('eb-card, eb-button')).toBeNull()
})

test('the update page is in Bangla when the page language is bn', async () => {
  const doc = await open('?floor=old&lang=bn')
  expect(doc.querySelector('h1')!.textContent).toBe('ebdfy ব্যবহার করতে ব্রাউজার আপডেট করুন')
  expect(doc.querySelector('p')!.textContent).toBe('এই ব্রাউজারটি ebdfy চালানোর জন্য অনেক পুরনো।')
  expect(doc.querySelector('a')!.textContent).toBe('Google Play থেকে Chrome নিন')
  expect(doc.querySelector('a')!.href).toBe(playStore)
})

test('an old Chrome user agent with declarative shadow DOM still gets the normal page', async () => {
  const doc = await open('?agent')
  expect(doc.defaultView!.navigator.userAgent).toContain('Chrome/90.')
  expect(doc.defaultView!.customElements.get('eb-card')).toBeDefined()
  expect(doc.querySelector('eb-card')).not.toBeNull()
  expect(doc.querySelector('h1')).toBeNull()
})

test('the update page has no horizontal scroll at 360 px and its link is 44 px tall', async () => {
  const doc = await open('?floor=old')
  expect(doc.documentElement.clientWidth).toBe(360)
  expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(doc.documentElement.clientWidth)
  expect(doc.querySelector('a')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
})
