import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

// expect.poll moves a fake clock while it waits, so a test that faked the clock would run its next
// step early, and pass with the step it means to check deleted.
test('expect.poll refuses to run while the clock is fake, even only Date', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const polled = async () => {
    await expect.poll(() => 1).toBe(1)
  }
  await expect(polled()).rejects.toThrow('expect.poll under fake timers')
})

test('expect.poll runs once the clock is real again', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.useRealTimers()
  await expect.poll(() => 1).toBe(1)
})
