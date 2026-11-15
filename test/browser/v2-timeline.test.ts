// e-timeline: what happened to a record, newest first, on a rail. Day labels, one-line steps of actor,
// action and time, a comment as its own block, and a composer form at the top. v2.css draws it whole.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineAvatar } from '../../src/v2/avatar.ts'
import { defineButton } from '../../src/v2/button.ts'
import { defineFields } from '../../src/v2/field.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const timeline = (lang = 'en') =>
  lang === 'bn'
    ? `<e-timeline lang="bn">
        <form slot="composer">
          <e-avatar name="রফিক আহমেদ"></e-avatar>
          <e-text-field label="মন্তব্য" name="comment"></e-text-field>
          <e-button type="submit">পোস্ট করুন</e-button>
        </form>
        <e-timeline-day>আজ</e-timeline-day>
        <e-timeline-item><strong slot="actor">রহিমা আক্তার</strong> ফেসবুক থেকে অর্ডার করেছেন, ক্যাশ অন ডেলিভারিতে, কালিয়াকৈর, গাজীপুরে পাঠাতে <time slot="time">সকাল ১১:২৪</time></e-timeline-item>
      </e-timeline>`
    : `<e-timeline>
        <form slot="composer">
          <e-avatar name="Rafiq Ahmed"></e-avatar>
          <e-text-field label="Comment" name="comment"></e-text-field>
          <e-button type="submit">Post</e-button>
        </form>
        <e-timeline-day>Today</e-timeline-day>
        <e-timeline-item kind="comment"><strong slot="actor">Rafiq Ahmed</strong><time slot="time">11:31 AM</time><p slot="body">Called twice, no answer. Will try after lunch.</p></e-timeline-item>
        <e-timeline-item><strong slot="actor">Rahima Akter</strong> placed the order on Facebook <time slot="time">11:24 AM</time></e-timeline-item>
        <e-timeline-day>Yesterday</e-timeline-day>
        <e-timeline-item><strong slot="actor">Rahima Akter</strong> asked about the saree on Messenger <time slot="time">9:02 PM</time></e-timeline-item>
      </e-timeline>`

function render(html: string, width = 640) {
  document.body.innerHTML = `<div style="width: ${width}px">${html}</div>`
  defineAvatar()
  defineButton()
  defineFields()
}

const rect = (el: Element) => el.getBoundingClientRect()

test('at 1280 px each step reads actor, action and time on one line, the time at the end', async () => {
  await page.viewport(1280, 800)
  render(timeline())
  const line = document.querySelectorAll('e-timeline-item')[1]!
  const actor = rect(line.querySelector('[slot="actor"]')!)
  const time = rect(line.querySelector('[slot="time"]')!)
  expect(Math.abs(time.top - actor.top)).toBeLessThanOrEqual(1)
  expect(Math.round(time.right)).toBe(Math.round(rect(line).right))
  // One 20 px line, and the space under it before the next step.
  expect(rect(line).height - Number.parseFloat(getComputedStyle(line).paddingBottom)).toBe(20)
  expect(getComputedStyle(line.querySelector('[slot="actor"]')!).fontWeight).toBe('600')
  const style = getComputedStyle(line.querySelector('[slot="time"]')!)
  expect([style.fontSize, style.fontVariantNumeric]).toEqual(['13px', 'tabular-nums'])
})

test('every step has a dot on one rail, and the rail runs on between them', async () => {
  await page.viewport(1280, 800)
  render(timeline())
  const steps = [...document.querySelectorAll('e-timeline-item')]
  const dots = steps.map((step) => {
    const dot = getComputedStyle(step, '::before')
    return { left: rect(step).left + Number.parseFloat(dot.left), width: dot.width, content: dot.content }
  })
  for (const dot of dots) {
    expect(dot.content).not.toBe('none')
    expect(dot.width).toBe('8px')
    expect(dot.left).toBe(dots[0]!.left)
  }
  // The rail is drawn on every step and day label but the last, and stays level with the dots.
  const parts = [...document.querySelectorAll('e-timeline-day, e-timeline-item')]
  for (const part of parts.slice(0, -1)) {
    const rail = getComputedStyle(part, '::after')
    expect(rail.content).not.toBe('none')
    expect(rail.width).toBe('1px')
    expect(Number.parseFloat(rail.height)).toBeGreaterThanOrEqual(rect(part).height - 1)
    expect(rect(part).left + Number.parseFloat(rail.left)).toBe(dots[0]!.left + 3.5)
  }
  // The actor starts right of the rail, and a day label starts where the actor does.
  const actor = rect(steps[0]!.querySelector('[slot="actor"]')!)
  expect(actor.left).toBeGreaterThan(dots[0]!.left + 8)
  expect(Math.round(rect(document.querySelector('e-timeline-day')!).left + 0)).toBeLessThanOrEqual(actor.left)
})

test('a comment draws its body as a block under its actor', () => {
  render(timeline())
  const comment = document.querySelector('e-timeline-item[kind="comment"]')!
  const actor = rect(comment.querySelector('[slot="actor"]')!)
  const body = comment.querySelector('[slot="body"]')!
  expect(rect(body).top).toBeGreaterThanOrEqual(actor.bottom)
  expect(Math.round(rect(body).left)).toBe(Math.round(actor.left))
  expect(getComputedStyle(body).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(getComputedStyle(body).marginTop).not.toBe('')
})

test('the day labels sit above their steps, quieter than the steps', () => {
  render(timeline())
  const [today, yesterday] = document.querySelectorAll('e-timeline-day')
  const steps = document.querySelectorAll('e-timeline-item')
  expect(rect(today!).bottom).toBeLessThanOrEqual(rect(steps[0]!).top)
  expect(rect(yesterday!).top).toBeGreaterThanOrEqual(rect(steps[1]!).bottom)
  expect(getComputedStyle(today!).fontSize).toBe('13px')
  expect(getComputedStyle(today!).color).toBe(getComputedStyle(steps[0]!.querySelector('[slot="time"]')!).color)
})

test('the composer is one row at the top: the writer’s initials, the field with its label shown, and Post', () => {
  render(timeline())
  const form = document.querySelector('form[slot="composer"]')!
  const avatar = rect(form.querySelector('e-avatar')!)
  const input = rect(form.querySelector('input')!)
  const button = rect(form.querySelector('e-button button')!)
  const label = form.querySelector('label')!
  expect(label.textContent).toBe('Comment')
  expect(rect(label).height).toBeGreaterThan(0)
  expect(rect(form).bottom).toBeLessThanOrEqual(rect(document.querySelector('e-timeline-day')!).top)
  expect(avatar.right).toBeLessThanOrEqual(input.left)
  expect(input.right).toBeLessThanOrEqual(button.left)
  expect(Math.abs(button.bottom - input.bottom)).toBeLessThanOrEqual(1)
  expect(Math.abs(avatar.top + avatar.height / 2 - (input.top + input.height / 2))).toBeLessThanOrEqual(1)
})

test('at 360 px a long Bangla step wraps beside its actor, its time still on its first line, and nothing scrolls sideways', () => {
  document.body.innerHTML = timeline('bn')
  defineAvatar()
  defineButton()
  defineFields()
  const step = document.querySelector('e-timeline-item')!
  const actor = rect(step.querySelector('[slot="actor"]')!)
  const time = rect(step.querySelector('[slot="time"]')!)
  expect(rect(step).height).toBeGreaterThan(40)
  expect(Math.abs(time.top - actor.top)).toBeLessThanOrEqual(2)
  expect(Math.round(time.right)).toBe(Math.round(rect(step).right))
  expect(document.documentElement.scrollWidth).toBe(360)
})
