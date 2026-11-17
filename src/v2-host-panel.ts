// A move between two of the Admin's own pages swaps the panel under the frame, which stays put: the
// host fetches the next page with the panel header, takes its panel and title, and pushes its address,
// so Back, Forward and a reload work as for whole pages. A server may answer the header with the
// panel alone or with the whole page; either way only its e-admin-panel is taken.

import type { Guard } from './v2-host-leave.ts'

// The request header that asks for the panel alone.
export const panelHeader = 'Ebdfy-Panel'

// Fired on the document with { panel } just before the new panel goes in, while the Admin can still
// change it, such as to put its words in the staff member's language.
export const panelEvent = 'ebdfy:panel'

// A panel can take the place of another only beside the same menu and with no app's frame in either:
// the app's page holds the chrome's bonds with the app, and another menu is another page's chrome.
const swappable = (panel: Element | null, next: Element | null): panel is Element =>
  !!panel &&
  !!next &&
  !panel.querySelector(':scope > iframe') &&
  !next.querySelector(':scope > iframe') &&
  panel.getAttribute('menu') === next.getAttribute('menu')

// The page the address shows, by its path and query: a move that changes only the hash keeps it.
const here = () => location.pathname + location.search

// The page the panel shows, so a Back or Forward tells a move within it from a move to another, and
// the place of its entry in this tab's history, which a Stay returns the address to.
let showing = ''
let showingIndex = 0

const pathOf = (link: HTMLAnchorElement) => new URL(link.href).pathname

// Puts a panel from another document in place of the frame's own, as a move or a save's answer
// does, under the address now shown.
export function putPanel(frame: Element, next: Element, title = ''): Element {
  const now = frame.querySelector(':scope > e-admin-panel')
  const adopted = document.adoptNode(next)
  document.dispatchEvent(new CustomEvent(panelEvent, { detail: { panel: adopted } }))
  if (title) document.title = title
  now?.replaceWith(adopted)
  showing = here()
  showingIndex = Number(history.state?.ebdfyIndex ?? showingIndex)
  // A sheet or menu the move was picked from, such as More's, has done its work.
  for (const open of frame.querySelectorAll<HTMLElement>(':popover-open')) open.hidePopover()
  // The menu marks the page now shown "page", and the area it belongs to "true": the menu entry whose
  // pages under it hold the page, and the tab to the same address.
  const links = [...frame.querySelectorAll<HTMLAnchorElement>('[slot="menu"] a[href], [slot="tabs"] a[href]')]
  const pages = links.find((link) => link.closest('.e-menu-pages') && pathOf(link) === location.pathname)
  const areaLink = pages?.closest('.e-menu-pages')?.previousElementSibling
  // A page with no link of its own, such as a new report or a product, belongs to the link whose
  // path shares the most leading parts with its own: the one whose whole path starts the page's, if
  // one does, or else the only one to share as many.
  const parts = location.pathname.split('/')
  const shared = (path: string) => {
    const own = path.split('/')
    const differs = own.findIndex((part, at) => part !== parts[at])
    return differs < 0 ? own.length : differs
  }
  const paths = [...new Set(links.map(pathOf))].map((path) => ({ path, shared: shared(path) }))
  const most = Math.max(...paths.map((one) => one.shared))
  const best = paths.filter((one) => one.shared === most)
  const holds = best.find((one) => one.shared === one.path.split('/').length)
  const under = holds?.path ?? (best.length === 1 ? best[0]!.path : undefined)
  const own = links.some((link) => pathOf(link) === location.pathname)
  const area = areaLink instanceof HTMLAnchorElement ? pathOf(areaLink) : own ? null : (under ?? null)
  for (const link of links) {
    const path = pathOf(link)
    if (path === location.pathname) link.setAttribute('aria-current', 'page')
    else if (path === area) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  }
  // Focus moves to the new page's heading, as a page load would start reading there.
  const heading = adopted.querySelector<HTMLElement>(':scope > header h1')
  if (heading && frame.contains(document.activeElement)) {
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
  return adopted
}

// guard is the save bar: while it holds an edit, Back and Forward return to the page and ask first,
// since the browser cannot cancel them.
export function swapPanels(frame: Element, guard?: Guard): void {
  const panel = () => frame.querySelector(':scope > e-admin-panel')
  if (!swappable(panel(), panel())) return
  // Each entry the frame answers carries its place in this tab's history, so a Back or Forward
  // tells how far it went. The first page's own entry is marked too.
  let shown = Number(history.state?.ebdfyIndex ?? 0)
  history.replaceState({ ...history.state, ebdfyPanel: true, ebdfyIndex: shown }, '')
  showing = here()
  showingIndex = shown

  let latest = 0
  // Puts the address back on the entry of the page the panel shows, after Back or Forward moved it.
  const returnHere = () => {
    if (showingIndex !== shown) history.go(showingIndex - shown)
  }
  const go = async (url: URL, push: boolean) => {
    const ticket = ++latest
    let next: Element | null = null
    let title = ''
    try {
      const response = await fetch(url, { headers: { [panelHeader]: '1' } })
      if (response.ok) {
        const page = new DOMParser().parseFromString(await response.text(), 'text/html')
        next = page.querySelector('e-admin-panel')
        title = page.title
      }
    } catch {
      next = null
    }
    // A later move has taken over.
    if (ticket !== latest) return
    const show = () => {
      if (!next || !swappable(panel(), next)) {
        if (push) location.assign(url)
        else location.reload()
        return
      }
      if (push) {
        shown += 1
        history.pushState({ ebdfyPanel: true, ebdfyIndex: shown }, '', url)
      }
      putPanel(frame, next, title)
    }
    // An edit typed, or a save started, while the page loaded asks first, as a tap on a page with an
    // edit does. Stay keeps the page, and puts back the address a Back or Forward already moved.
    if (guard?.dirty) {
      guard.leave(show, returnHere)
      return
    }
    show()
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || !frame.contains(link)) return
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin) return
    // A link to a place in this page is the browser's to follow.
    if (url.pathname + url.search === here() && url.hash) return
    event.preventDefault()
    // A row picked in the search modal closes it before the panel changes under it.
    link.closest('dialog')?.close()
    void go(url, url.href !== location.href)
  })
  window.addEventListener('popstate', () => {
    const index = Number(history.state?.ebdfyIndex)
    // A hash moved, or the guard brought the page's own entry back: the panel stays.
    if (here() === showing) {
      if (Number.isFinite(index)) {
        shown = index
        showingIndex = index
      } else {
        // A link to a place on the page made this entry: it takes the next place, so a Back or
        // Forward onto it later tells how far it went and asks first from a page with an edit.
        shown += 1
        showingIndex = shown
        history.replaceState({ ...history.state, ebdfyPanel: true, ebdfyIndex: shown }, '')
      }
      return
    }
    if (guard?.dirty && Number.isFinite(index)) {
      const went = index - showingIndex
      shown = index
      returnHere()
      guard.leave(() => history.go(went))
      return
    }
    if (Number.isFinite(index)) shown = index
    void go(new URL(location.href), false)
  })
}

// A menu of its own, such as Settings', leads back by its [data-back] row to the last address shown
// beside the main menu in this tab, or else to where its markup points, Home.
const backKey = 'ebdfy-admin-back'

export function rememberBack(frame: Element): void {
  const panel = frame.querySelector(':scope > e-admin-panel')
  if (!panel) return
  if (!panel.hasAttribute('menu')) {
    // The address as it is when the page goes, after the app or the panel moved it.
    window.addEventListener('pagehide', () => {
      try {
        sessionStorage.setItem(backKey, location.pathname + location.search)
      } catch {
        // With no storage the Back row keeps its markup's address.
      }
    })
    return
  }
  let address: string | null = null
  try {
    address = sessionStorage.getItem(backKey)
  } catch {
    address = null
  }
  const back = frame.querySelector('[slot="menu"] > a[data-back]')
  // Only a path on this origin: //host would lead off it.
  if (back && address?.startsWith('/') && !address.startsWith('//')) back.setAttribute('href', address)
}
