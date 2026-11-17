// The app page's title bar, built from e-page's record header: the app's tile and the title it sets,
// which the page's markup holds, then the app's actions. The one the app marks primary draws as the
// primary button; an action with items opens a menu of them. Below 600 px every action but the
// primary moves into a ⋯ menu on the title row, and with no primary both do. A press posts the
// action's index, and the item's, back to the app, whose handler runs.
import type { BridgeMessage } from './bridge.ts'
import { cut, navLabelLimit } from './host-rules.ts'
import { button, say } from './v2-host-app.ts'

type Title = Extract<BridgeMessage, { type: 'title' }>['payload']

const icon = (name: string) => {
  const made = document.createElement('e-icon')
  made.setAttribute('name', name)
  return made
}

const item = (label: string, critical: boolean, press: () => void) => {
  const made = document.createElement('e-menu-item')
  made.textContent = label
  if (critical) made.setAttribute('tone', 'danger')
  made.addEventListener('click', press)
  return made
}

// A menu opened by the trigger given, holding the items given.
const menu = (trigger: HTMLElement, items: HTMLElement[]) => {
  const made = document.createElement('e-menu')
  trigger.slot = 'trigger'
  made.append(trigger, ...items)
  return made
}

export function titleBar(heading: Element, press: (call: number, index: number, item?: number) => void) {
  const actions = document.createElement('div')
  actions.className = 'e-title-actions'
  heading.after(actions)
  let shown: Title | null = null

  const draw = () => {
    const title = shown
    if (!title) return actions.replaceChildren()
    const call = Number(title.call)
    const labels = (Array.isArray(title.actions) ? title.actions : []).slice(0, 2)
    const menus = Array.isArray(title.menus) ? title.menus : []
    const primary = Number.isInteger(title.primary) ? Number(title.primary) : -1
    const parts: HTMLElement[] = []
    const folded: HTMLElement[] = []
    labels.forEach((raw, index) => {
      const label = cut(String(raw ?? '').trim(), navLabelLimit)
      const items = Array.isArray(menus[index]) ? (menus[index] ?? []) : null
      const pick = (at?: number) => () => press(call, index, at)
      const made = button('e-button', label)
      if (index === primary) made.setAttribute('tone', 'primary')
      const each = () =>
        items?.map((one, at) => item(cut(String(one?.label ?? ''), navLabelLimit), one?.tone === 'critical', pick(at)))
      if (items) made.append(icon('chevron-down'))
      else made.addEventListener('click', pick())
      const part = items ? menu(made, each()!) : made
      parts.push(part)
      if (index === primary) return
      part.dataset.folds = ''
      folded.push(...(each() ?? [item(label, false, pick())]))
    })
    // On a phone the ⋯ menu holds what the row folds away.
    if (folded.length) {
      const more = button('e-button', '')
      more.setAttribute('icon', '')
      more.setAttribute('aria-label', say().moreActions)
      more.append(icon('more-horizontal'))
      const kept = menu(more, folded)
      kept.className = 'e-title-more'
      parts.push(kept)
    }
    actions.replaceChildren(...parts)
  }
  // The ⋯ button's name is the chrome's, so it follows the page's language.
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

  return {
    show(title: Title | undefined) {
      shown = title ?? null
      draw()
    },
  }
}
