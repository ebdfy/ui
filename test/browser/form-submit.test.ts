import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

const inner = (el: Element, selector: string) => (el as Upgraded).shadowRoot.querySelector<HTMLElement>(selector)!

// A login and consent form as the API's server-rendered pages build it. Each submit is caught and
// its entries kept, so the page never navigates.
async function mount(extra = '') {
  document.body.innerHTML = `<form>
    <eb-text-field name="email" type="email" autocomplete="username" required></eb-text-field>
    <eb-text-field name="password" type="password" autocomplete="current-password"></eb-text-field>
    <eb-button type="submit" name="decision" value="install">Install</eb-button>
    <eb-button type="submit" name="decision" value="cancel">Cancel</eb-button>
    ${extra}
  </form>`
  const form = document.querySelector('form')!
  await Promise.all([...form.querySelectorAll<Upgraded>('eb-text-field, eb-button')].map((el) => el.updateComplete))
  const submits: [string, string][][] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submits.push([...new FormData(form)].map(([key, value]) => [key, String(value)]))
  })
  const [email, password] = form.querySelectorAll('eb-text-field')
  const [install, cancel] = form.querySelectorAll('eb-button')
  return { form, email: email!, password: password!, install: install!, cancel: cancel!, submits }
}

test('clicking Cancel submits decision=cancel with the email, and never install', async () => {
  const { email, cancel, submits } = await mount()
  await userEvent.fill(inner(email, 'input'), 'rahim@example.com')
  await userEvent.click(inner(cancel, 'button'))
  expect(submits).toEqual([
    [
      ['email', 'rahim@example.com'],
      ['password', ''],
      ['decision', 'cancel'],
    ],
  ])
})

test('clicking Install after Cancel submits decision=install only', async () => {
  const { email, install, cancel, submits } = await mount()
  await userEvent.fill(inner(email, 'input'), 'rahim@example.com')
  await userEvent.click(inner(cancel, 'button'))
  await userEvent.click(inner(install, 'button'))
  expect(submits[1]).toEqual([
    ['email', 'rahim@example.com'],
    ['password', ''],
    ['decision', 'install'],
  ])
})

test('the inner inputs take the type and autocomplete the fields name', async () => {
  const { email, password } = await mount()
  const emailInput = inner(email, 'input')
  const passwordInput = inner(password, 'input')
  expect([emailInput.getAttribute('type'), emailInput.getAttribute('inputmode')]).toEqual(['email', 'email'])
  expect(emailInput.getAttribute('autocomplete')).toBe('username')
  expect(passwordInput.getAttribute('type')).toBe('password')
  expect(passwordInput.getAttribute('autocomplete')).toBe('current-password')
})

test('a submit eb-button does not submit while a required field is empty', async () => {
  const { install, submits } = await mount()
  await userEvent.click(inner(install, 'button'))
  expect(submits).toEqual([])
})

// As a native form does: Enter presses the form's first submit button, so its pair goes too.
test('pressing Enter in the password field submits through the first submit button', async () => {
  const { email, password, submits } = await mount()
  await userEvent.fill(inner(email, 'input'), 'rahim@example.com')
  await userEvent.type(inner(password, 'input'), 'secret{Enter}')
  expect(submits).toEqual([
    [
      ['email', 'rahim@example.com'],
      ['password', 'secret'],
      ['decision', 'install'],
    ],
  ])
})

// A save-bar form has no submit button; a native form like it submits on Enter only when it has a
// single text field.
async function buttonless(fields: string) {
  document.body.innerHTML = `<form>${fields}</form>`
  const form = document.querySelector('form')!
  await Promise.all([...form.querySelectorAll<Upgraded>('*')].map((el) => el.updateComplete))
  let submits = 0
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submits += 1
  })
  return { form, submits: () => submits }
}

test('pressing Enter does not submit a form with two text fields and no submit button', async () => {
  const { form, submits } = await buttonless(
    '<eb-text-field name="name"></eb-text-field><eb-phone-field name="phone"></eb-phone-field>',
  )
  await userEvent.type(inner(form.querySelector('eb-text-field')!, 'input'), 'Rahim{Enter}')
  expect(submits()).toBe(0)
})

test('pressing Enter submits a form whose only field it is, with no submit button', async () => {
  const { form, submits } = await buttonless('<eb-search-field name="q"></eb-search-field>')
  await userEvent.type(inner(form.querySelector('eb-search-field')!, 'input'), 'kurti{Enter}')
  expect(submits()).toBe(1)
})

test('an eb-button with no type does not submit its form', async () => {
  const { email, form, submits } = await mount('<eb-button>Show password</eb-button>')
  await userEvent.fill(inner(email, 'input'), 'rahim@example.com')
  await userEvent.click(inner(form.querySelectorAll('eb-button')[2]!, 'button'))
  expect(submits).toEqual([])
})

test('each text field subclass keeps its own input type', async () => {
  document.body.innerHTML = `<eb-text-field></eb-text-field><eb-phone-field></eb-phone-field>
    <eb-search-field></eb-search-field><eb-date-field></eb-date-field>`
  const fields = [...document.body.children] as Upgraded[]
  await Promise.all(fields.map((field) => field.updateComplete))
  expect(fields.map((field) => inner(field, 'input').getAttribute('type'))).toEqual(['text', 'tel', 'search', 'date'])
})
