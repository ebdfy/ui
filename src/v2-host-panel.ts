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

// Puts a panel from another document in place of the frame's own, as a move or a save's answer
// does, under the address now shown.
export function putPanel(frame: Element, next: Element, title = ''): Element {
  const now = frame.querySelector(':scope > e-admin-panel')
  const adopted = document.adoptNode(next)
  document.dispatchEvent(new CustomEvent(panelEvent, { detail: { panel: adopted } }))
  if (title) document.title = title
  now?.replaceWith(adopted)
  // A sheet or menu the move was picked from, such as More's, has done its work.
  for (const open of frame.querySelectorAll<HTMLElement>(':popover-open')) open.hidePopover()
  // The menu marks the page now shown; the area it belongs to keeps its mark.
  for (const link of frame.querySelectorAll<HTMLAnchorElement>('[slot="menu"] a[href], [slot="tabs"] a[href]')) {
    const here = new URL(link.href).pathname === location.pathname
    if (here) link.setAttribute('aria-current', 'page')
    else if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current')
  }
  // Focus moves to the new page's heading, as a page load would start reading there.
  const heading = adopted.querySelector<HTMLElement>(':scope > header h1')
  if (heading && frame.contains(document.activeElement)) {
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
  return adopted
}

// The page the address shows, by its path and query: a move that changes only the hash keeps it.
const here = () => location.pathname + location.search

// guard is the save bar: while it holds an edit, Back and Forward return to the page and ask first,
// since the browser cannot cancel them.
export function swapPanels(frame: Element, guard?: Guard): void {
  const panel = () => frame.querySelector(':scope > e-admin-panel')
  if (!swappable(panel(), panel())) return
  // Each entry the frame answers carries its place in this tab's history, so a Back or Forward
  // tells how far it went. The first page's own entry is marked too.
  let shown = Number(history.state?.ebdfyIndex ?? 0)
  history.replaceState({ ...history.state, ebdfyPanel: true, ebdfyIndex: shown }, '')
  let showing = here()

  let latest = 0
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
    const now = panel()
    if (!next || !swappable(now, next)) {
      if (push) location.assign(url)
      else location.reload()
      return
    }
    if (push) {
      shown += 1
      history.pushState({ ebdfyPanel: true, ebdfyIndex: shown }, '', url)
    }
    showing = here()
    putPanel(frame, next, title)
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
    void go(url, url.href !== location.href)
  })
  window.addEventListener('popstate', () => {
    const index = Number(history.state?.ebdfyIndex)
    // A hash moved, or the guard brought the page's own entry back: the panel stays.
    if (here() === showing) {
      if (Number.isFinite(index)) shown = index
      return
    }
    if (guard?.dirty && Number.isFinite(index)) {
      const went = index - shown
      history.go(-went)
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
