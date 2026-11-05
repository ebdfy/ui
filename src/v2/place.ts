// Puts a shown panel below its trigger, start edges aligned, nudged to stay `edge` px inside the
// window; above it only when there is no room below, and then it scrolls for what does not fit. Plain
// JS (position: fixed), as the browser floor has no popover attribute or CSS anchor positioning. The
// menu, the popover and the tooltip place their panels with it.
const gap = 4
const edge = 8

export function place(trigger: Element, panel: HTMLElement): void {
  panel.style.maxHeight = ''
  const anchor = trigger.getBoundingClientRect()
  const size = panel.getBoundingClientRect()
  let top = anchor.bottom + gap
  const above = anchor.top - gap - size.height
  const room = window.innerHeight - edge - top
  if (size.height > room && above >= edge) top = above
  else if (size.height > room) panel.style.maxHeight = `${room}px`
  panel.style.left = `${Math.max(edge, Math.min(anchor.left, window.innerWidth - edge - size.width))}px`
  panel.style.top = `${top}px`
}
