// The app's page in the Admin's address, and the app's own nav. Like the rest of the chrome, it acts
// only on messages from the app's frame, from the origin the frame's URL names.
import { navLimit, type BridgeMessage, type NavEntry } from './bridge.ts'
import { cut, navLabelLimit } from './host-rules.ts'
import type { PageMessage } from './v2/bridge.ts'

// The part of an app page's URL after the app's registered URL, with its query but never the store:
// '' for the app's home, null for a page outside the app.
export function appPath(page: URL, app: URL): string | null {
  const root = app.pathname.replace(/\/$/, '')
  if (page.origin !== app.origin) return null
  if (page.pathname !== root && !page.pathname.startsWith(`${root}/`)) return null
  const query = new URLSearchParams(page.search)
  query.delete('store')
  const rest = page.pathname.slice(root.length)
  return `${rest === '/' ? '' : rest}${query.size ? `?${query}` : ''}`
}

// The panel names the app's registered URL and the Admin address that shows its home. From 1040 px
// the app's nav sits in the menu under the Admin's current entry. Below, it is a menu that a button
// at the end of the title bar opens over the app, so the panel never moves when the app names its
// pages. Each is hidden while the app names no pages.
export function followPage(panel: Element, frame: HTMLIFrameElement): void {
  const appOrigin = () => new URL(frame.src, location.href).origin
  const app = new URL(panel.getAttribute('app-url') ?? frame.src, location.href)
  const base = panel.getAttribute('base') ?? location.pathname

  const made = (name: string) => {
    const nav = document.createElement('nav')
    nav.className = name
    nav.setAttribute('aria-label', frame.title)
    nav.hidden = true
    return nav
  }
  const side = made('e-app-nav')
  const pages = made('e-app-pages')
  pages.popover = 'auto'
  pages.id = 'e-app-pages'
  const menu = document.querySelector('e-admin-frame > [slot="menu"]')
  const here = menu?.querySelector(':scope > a[aria-current="page"]')
  if (here) here.after(side)
  else menu?.append(side)
  const header = panel.querySelector(':scope > header')
  const opener = document.createElement('button')
  opener.type = 'button'
  opener.className = 'e-app-pages-button'
  opener.setAttribute('aria-label', frame.title)
  opener.popoverTargetElement = pages
  opener.hidden = true
  const chevron = document.createElement('e-icon')
  chevron.setAttribute('name', 'chevron-down')
  opener.append(chevron)
  header?.append(opener)
  panel.append(pages)
  // The menu opens just under the title bar, across the panel.
  pages.addEventListener('beforetoggle', () => {
    const below = header?.getBoundingClientRect().bottom ?? 0
    pages.style.top = `${below}px`
  })

  let page: URL | null = null
  let entries: { label: string; url: URL }[] = []

  // An entry is current when the page's path is its own or under it; the longest such entry wins.
  const draw = () => {
    const path = page?.pathname ?? ''
    const current = entries
      .filter(({ url }) => path === url.pathname || path.startsWith(`${url.pathname}/`))
      .sort((one, other) => other.url.pathname.length - one.url.pathname.length)[0]
    for (const nav of [side, pages]) {
      nav.replaceChildren(
        ...entries.map((entry) => {
          const link = document.createElement('a')
          link.href = entry.url.href
          link.textContent = entry.label
          if (entry === current) link.setAttribute('aria-current', 'page')
          link.addEventListener('click', (event) => {
            event.preventDefault()
            if (pages.matches(':popover-open')) pages.hidePopover()
            frame.setAttribute('src', entry.url.href)
          })
          return link
        }),
      )
      nav.hidden = entries.length === 0
    }
    opener.hidden = entries.length === 0
  }

  // A nav path is a path on the app's origin; its page opens with the frame's query, the store.
  const setNav = (list: NavEntry[] | undefined) => {
    const frameUrl = new URL(frame.src, location.href)
    entries = (Array.isArray(list) ? list : []).slice(0, navLimit).flatMap((entry) => {
      const path = String(entry?.path ?? '')
      const label = cut(String(entry?.label ?? '').trim(), navLabelLimit)
      if (!path.startsWith('/') || !label) return []
      const url = new URL(path, frameUrl)
      if (url.origin !== frameUrl.origin) return []
      if (!url.search) url.search = frameUrl.search
      return [{ label, url }]
    })
    draw()
  }

  // The Admin's address shows the app's page. It is replaced, never pushed: the frame's own history
  // entries carry Back and Forward, and the app names its page again as it gets there.
  const follow = (href: string) => {
    if (!URL.canParse(href)) return
    page = new URL(href)
    const path = appPath(page, app)
    if (path !== null && `${base}${path}` !== location.pathname + location.search) {
      history.replaceState(history.state, '', `${base}${path}`)
    }
    draw()
  }

  window.addEventListener('message', (event: MessageEvent<BridgeMessage | PageMessage>) => {
    const own = frame.contentWindow
    if (!own || event.source !== own || event.origin !== appOrigin()) return
    const data = event.data
    if (data?.type === 'ready' || data?.type === 'page') follow(String(data.payload?.page ?? ''))
    if (data?.type === 'nav') setNav(data.payload?.entries)
  })
}
