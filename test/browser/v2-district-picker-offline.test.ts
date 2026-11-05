import { expect, test } from 'vitest'

// The district picker before its upazila list arrives, or when fetching it failed: the form still
// sends the opening upazila, and the next picker asks for the list again.
import '../../src/v2.css'
import { defineDistrictPicker } from '../../src/v2/district-picker.ts'

const sent = (form: HTMLFormElement) => new URLSearchParams(new FormData(form) as never).toString()

test('with no upazila list the form still sends the opening upazila, and a later picker fetches it again', async () => {
  const fetching = globalThis.fetch
  globalThis.fetch = () => Promise.reject(new TypeError('offline'))
  document.body.innerHTML = '<form><e-district-picker district="dhaka" upazila="mirpur"></e-district-picker></form>'
  defineDistrictPicker()
  const form = document.querySelector('form')!
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(sent(form)).toBe('district=dhaka&upazila=mirpur')

  globalThis.fetch = fetching
  document.body.innerHTML = '<form><e-district-picker district="dhaka" upazila="mirpur"></e-district-picker></form>'
  const upazila = document.querySelectorAll('select')[1]!
  await expect.poll(() => upazila.selectedOptions[0]?.text).toBe('Mirpur')
})
