// The speed job GitHub runs on every pull request that touches the ui: it has the phones' Bangla font
// and runs the speed check, which fails the job when a number is over its budget.
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const workflow = readFileSync(new URL('../../../../.github/workflows/ui-speed.yml', import.meta.url), 'utf8')
const steps = workflow.split(/\n(?=\s+- (?:name|uses):)/).slice(1)
const at = (text: string) => steps.findIndex((step) => step.includes(text))

test('every pull request that touches the ui runs the speed job on a GitHub-hosted runner', () => {
  expect(workflow).toMatch(/\non:\n {2}pull_request:\n {4}paths:\n {6}- 'packages\/ui\/\*\*'\n/)
  expect(workflow).toMatch(/\n {2}speed:\n {4}runs-on: ubuntu-\d/)
})

test('the job installs, gets Chromium and Noto Sans Bengali, then runs the speed check', () => {
  const order = [
    'pnpm install --frozen-lockfile',
    'playwright install --with-deps chromium',
    'apt-get install -y fonts-noto-core',
    'pnpm --filter @ebdfy/ui test:speed',
  ].map(at)
  expect(order.every((index) => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
})

test('the speed check is the package script that runs the speed tests', () => {
  const scripts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts
  expect(scripts['test:speed']).toBe('vitest run --config vitest.speed.config.ts')
  const config = readFileSync(new URL('../../vitest.speed.config.ts', import.meta.url), 'utf8')
  expect(config).toContain("include: ['test/speed/**/*.test.ts']")
})
