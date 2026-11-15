// The playground's dev server answers a save of Settings > Store as the Admin's Worker will: a bar
// save gets the panel, saved or with the field's error in markup, and a cookie makes it hang,
// answer a conflict or answer 401.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { saveBarHeader } from '../../scripts/store-fake.ts'
import { panelHeader } from '../../src/v2-host-panel.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const url = () => `${pages.ui}/playground/settings/store`

function save(contactPhone: string, headers: Record<string, string> = {}, multipart = false) {
  const fields = { name: 'Corner shop', contactPhone, weightUnit: 'GRAMS' }
  if (multipart) {
    const body = new FormData()
    for (const [name, value] of Object.entries(fields)) body.set(name, value)
    return fetch(url(), { method: 'POST', headers, body })
  }
  return fetch(url(), { method: 'POST', headers, body: new URLSearchParams(fields) })
}

test('a bar save with a short phone is refused with the error in the panel', async () => {
  const response = await save('0181955669', { [saveBarHeader]: '1' })
  const body = await response.text()
  expect(response.status).toBe(422)
  expect(response.headers.get('content-type')).toContain('text/html')
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(body).toContain('<e-admin-panel')
  expect(body).not.toContain('<html')
  expect(body).toContain('error="Enter an 11-digit mobile number that starts with 01."')
  expect(body).toContain('data-bn-error="০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর লিখুন।"')
  expect(body).toContain('value="0181955669"')
  expect(body).not.toContain('toast=')
})

test('a bar save with a good phone is saved and answers the panel with the posted values', async () => {
  for (const phone of ['01819556690', '01819-556690']) {
    const response = await save(phone, { [saveBarHeader]: '1' })
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain('toast="Store saved" data-bn-toast="স্টোর সংরক্ষিত হয়েছে"')
    expect(body).toContain(`value="${phone}"`)
    expect(body).toContain('value="Corner shop"')
    expect(body).not.toContain('error=')
    expect(body).not.toContain('<html')
    // The select moves its selected option, and the switch, not posted, is no longer checked.
    expect(body).toMatch(/<option value="GRAMS" selected>/)
    expect(body).not.toMatch(/<option value="KILOGRAMS" selected>/)
    expect(body).not.toMatch(/<e-switch[^>]*\schecked/)
  }
})

test('a multipart save is read as a urlencoded one is, and a posted value is escaped', async () => {
  const response = await save('0181" onfocus="x', { [saveBarHeader]: '1' }, true)
  const body = await response.text()
  expect(response.status).toBe(422)
  expect(body).toContain('value="0181&quot; onfocus=&quot;x"')
})

test('an empty phone is allowed', async () => {
  const response = await save('', { [saveBarHeader]: '1' })
  expect(response.status).toBe(200)
})

test('a native post answers the whole page', async () => {
  const response = await save('01819556690')
  const body = await response.text()
  expect(response.status).toBe(200)
  expect(body).toContain('<html')
  expect(body).toContain('<e-admin-frame')
  expect(body).toContain('toast="Store saved"')
  expect(body).toContain('value="01819556690"')
})

test('a native post with a bad phone answers the whole page and the error', async () => {
  const response = await save('123')
  const body = await response.text()
  expect(response.status).toBe(422)
  expect(body).toContain('<html')
  expect(body).toContain('error="Enter an 11-digit mobile number that starts with 01."')
  expect(body).not.toContain('toast=')
})

test('the conflict and expired cookies answer 409 and 401 with no body', async () => {
  for (const [cookie, status] of [
    ['conflict', 409],
    ['expired', 401],
  ] as const) {
    const posts: Record<string, string>[] = [{ [saveBarHeader]: '1' }, { 'x-native': '1' }]
    for (const headers of posts) {
      const response = await save('01819556690', { ...headers, cookie: `ebdfy-store-fake=${cookie}` })
      expect(response.status).toBe(status)
      expect(await response.text()).toBe('')
    }
  }
})

test('another cookie value saves as usual', async () => {
  const response = await save('01819556690', { [saveBarHeader]: '1', cookie: 'ebdfy-store-fake=other' })
  expect(response.status).toBe(200)
})

test('the hang cookie never answers', async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1000)
  const request = fetch(url(), {
    method: 'POST',
    headers: { [saveBarHeader]: '1', cookie: 'ebdfy-store-fake=hang' },
    body: new URLSearchParams({ contactPhone: '01819556690' }),
    signal: controller.signal,
  })
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  clearTimeout(timer)
})

test('a GET with the panel header still answers the panel, with no toast', async () => {
  const response = await fetch(url(), { headers: { [panelHeader]: '1' } })
  const body = await response.text()
  expect(response.status).toBe(200)
  expect(body).toContain('<e-admin-panel')
  expect(body).not.toContain('<html')
  expect(body).not.toContain('toast=')
  expect(body).toContain('value="01819-556680"')
})
