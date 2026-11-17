// The Admin's leave question answers by its own dialog's closing, never by an earlier one's.
import { expect, test } from 'vitest'

import { askToLeave } from '../../src/v2-host-leave.ts'

const question = {
  title: 'Leave without saving?',
  sentence: 'Store has changes.',
  stay: 'Stay on this page',
  leave: 'Leave',
}
const press = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('dialog.e-leave e-button')].find((b) => b.textContent === name)!.click()

// Chromium can deliver Stay's close event after a Back at once asked again, while the dialog is open
// for the new question: that late event must leave the new question open for its own answer.
test("a close event that comes while the question is open again leaves it to that question's Leave", async () => {
  const frame = document.createElement('div')
  document.body.append(frame)
  const first = askToLeave(frame, question)
  press('Stay on this page')
  expect(await first).toBe(false)
  const answers: boolean[] = []
  const second = askToLeave(frame, question).then((left) => answers.push(left))
  const box = document.querySelector<HTMLDialogElement>('dialog.e-leave')!
  box.dispatchEvent(new Event('close'))
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(answers).toEqual([])
  expect(box.open).toBe(true)
  press('Leave')
  await second
  expect(answers).toEqual([true])
})
