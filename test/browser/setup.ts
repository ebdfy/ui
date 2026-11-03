import { expect, vi } from 'vitest'

// expect.poll advances a fake clock while it waits, so a test that faked the clock ran its next
// step early and once passed with the step it checked deleted. Under fake timers, await an event.
const poll = expect.poll
expect.poll = ((...args: Parameters<typeof poll>) => {
  if (vi.isFakeTimers()) {
    throw new Error('expect.poll under fake timers moves the clock; await the side effect as an event')
  }
  return poll(...args)
}) as typeof poll
