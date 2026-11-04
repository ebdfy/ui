// The host half of the bridge, for the playground and the Admin, never for apps. It draws the
// admin chrome around an app's frame and takes messages only from that frame.
import { LitElement, css, html, nothing, render, unsafeCSS, type PropertyValues, type SVGTemplateResult } from 'lit'
import { keyed } from 'lit/directives/keyed.js'

import {
  navLimit,
  titleActionLimit,
  type BridgeMessage,
  type HostMessage,
  type IdTokenAnswer,
  type ModalOptions,
  type NavEntry,
  type TitleMenuItem,
} from './bridge.ts'
import './floor.ts'
import { EbMenu, EbMenuItem } from './components/menu.ts'
import { EbSkeleton } from './components/skeleton.ts'
import { installFonts } from './fonts.ts'
import { digits } from './format.ts'
import { chevronLeft, close, icons, triangleAlert } from './icons.ts'
import { focusRing, installTokens } from './tokens.ts'

export const titleLimit = 60
export const toastLimit = 120
export const navLabelLimit = 24
// How long an app has to answer before the chrome says it isn't responding.
export const answerSeconds = 15
const toastSeconds = 5

const words = {
  bn: {
    loading: 'লোড হচ্ছে',
    stalled: 'অ্যাপটি সাড়া দিচ্ছে না',
    reload: 'আবার লোড করুন',
    unsaved: 'অসংরক্ষিত পরিবর্তন',
    discard: 'বাতিল',
    save: 'সংরক্ষণ',
    dismiss: 'বন্ধ করুন',
    leaveAsk: 'সংরক্ষণ না করে চলে যাবেন?',
    leave: 'চলে যান',
    stay: 'থাকুন',
    close: 'বন্ধ করুন',
    accessEnded: 'এই স্টোরে আপনার আর অ্যাক্সেস নেই',
    chooseStore: 'একটি স্টোর বেছে নিন',
    back: 'ফিরে যান',
    stalledHelp: '১৫ সেকেন্ডেও অ্যাপটি সাড়া দেয়নি। আবার লোড করুন, অথবা আরও অপেক্ষা করুন।',
    keepWaiting: 'অপেক্ষা করুন',
    accessHelp: 'স্টোরের মালিককে আবার যোগ করতে বলুন, অথবা অন্য একটি স্টোর বেছে নিন।',
    tryAgain: 'আবার চেষ্টা করুন',
  },
  en: {
    loading: 'Loading',
    stalled: "This app isn't responding",
    reload: 'Reload',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
    save: 'Save',
    dismiss: 'Dismiss',
    leaveAsk: 'Leave without saving?',
    leave: 'Leave',
    stay: 'Stay',
    close: 'Close',
    accessEnded: 'You no longer have access to this store',
    chooseStore: 'Choose a store',
    back: 'Back',
    stalledHelp: "It hasn't answered for 15 seconds. Reload it, or keep waiting.",
    keepWaiting: 'Keep waiting',
    accessHelp: "Ask the store's owner to add you again, or choose another store.",
    tryAgain: 'Try again',
  },
}

const letters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Counts letters, not code points, so a Bangla conjunct is never split.
function cut(text: string, limit: number): string {
  const parts = Array.from(letters.segment(text), (s) => s.segment)
  return parts.length <= limit ? text : `${parts.slice(0, limit - 1).join('')}…`
}

export function cutTitle(title: string): string {
  return cut(title, titleLimit)
}

// A title action's menu items, or null when the app sent none or sent them malformed, which keeps
// the action a plain button.
function menuItems(menu: TitleMenuItem[] | null | undefined): TitleMenuItem[] | null {
  if (!Array.isArray(menu) || menu.length === 0) return null
  const items = menu.map((item) => ({
    label: String(item?.label ?? '').trim(),
    tone: item?.tone === 'critical' ? item.tone : undefined,
  }))
  return items.every((item) => item.label) ? items : null
}

const modalSizes = new Set(['small', 'medium', 'large'])
// The icons an app's nav entry may name, as eb-icon names them.
const navIcons = new Map(Object.entries(icons))

// The Admin's own links are the page's, so the chrome cannot put an icon inside one. A link names
// its icon in data-icon instead, and the chrome draws it before the label as a mask of that icon,
// in the link's colour. A name it does not know draws nothing.
function maskOf(icon: SVGTemplateResult): string {
  const box = document.createElement('div')
  render(icon, box)
  return `url("data:image/svg+xml,${encodeURIComponent(box.querySelector('svg')?.outerHTML ?? '')}")`
}
const slottedIcons = unsafeCSS(
  [...navIcons]
    .map(([name, icon]) => `::slotted([data-icon='${name}'])::before { content: ''; mask-image: ${maskOf(icon)}; }`)
    .join('\n'),
)

// The element with focus, inside any shadow roots.
function focused(): HTMLElement | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element instanceof HTMLElement ? element : null
}

/**
 * The Admin's frame around an app: the header, the navigation, the save bar, toasts and modals, with
 * the app's own pages in a frame inside it. The app talks to it through the ebdfy bridge.
 *
 * @slot nav - Navigation links, each an a element, which the chrome shows in its sidebar.
 */
export class EbAdminChrome extends LitElement {
  static override properties = {
    src: { type: String },
    appName: { type: String, attribute: 'app-name' },
    // Where the chrome mints the app's ID tokens, and the API those tokens open.
    tokenUrl: { type: String, attribute: 'token-url' },
    apiUrl: { type: String, attribute: 'api-url' },
    // The store picker, where a staff member whose access has ended goes next.
    storesUrl: { type: String, attribute: 'stores-url' },
    accessEnded: { state: true, attribute: false },
    // The page of the app the frame shows, which a nav entry changes.
    frameSrc: { state: true, attribute: false },
    appNav: { state: true, attribute: false },
    // The page the app is on, which the chrome loaded or the app moved to by itself.
    appPage: { state: true, attribute: false },
    // False from the moment the chrome loads a page until the app's bridge first speaks.
    answered: { state: true, attribute: false },
    // False until the app's bridge says it is ready, the frame hidden behind skeleton blocks meanwhile.
    ready: { state: true, attribute: false },
    // What the app last asked for with ebdfy.loading.
    busy: { state: true, attribute: false },
    // Whether the app's page shows an eb-bottom-bar, which hides the tab bar on a phone.
    bottomBar: { state: true, attribute: false },
    stalled: { state: true, attribute: false },
    // attribute: false tells the manifest analyzer, which ignores state, that this is no attribute.
    appTitle: { state: true, attribute: false },
    titleActions: { state: true, attribute: false },
    titleBack: { state: true, attribute: false },
    saveBar: { state: true, attribute: false },
    toast: { state: true, attribute: false },
    modal: { state: true, attribute: false },
  }

  static override styles = [
    css`
      ${focusRing}
      :host {
        display: flex;
        flex-direction: column;
        height: 100dvh;
        background: var(--eb-color-bg);
        color: var(--eb-color-text);
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        line-height: var(--eb-line-height-body);
      }
      header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 56px;
        padding: 0 var(--eb-space-card);
        background: var(--eb-color-bg);
        color: var(--eb-color-text);
        box-shadow: inset 0 -1px 0 var(--eb-color-divider);
      }
      /* On the inverse surface the light theme's violet ring sits just under 3:1, so the ring there
       takes the inverse action colour. */
      header:has([part='save-bar']) {
        --eb-color-focus: var(--eb-color-inverse-act);
        background: var(--eb-color-inverse);
        color: var(--eb-color-on-inverse);
        box-shadow: inset 0 0 0 1px var(--eb-color-inverse-edge);
      }
      [part='title'] {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: var(--eb-font-size-heading-3);
        font-weight: var(--eb-font-weight-semibold);
        line-height: var(--eb-line-height-heading-3);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      nav {
        display: flex;
        gap: var(--eb-space-gap);
        overflow-x: auto;
        padding: 4px var(--eb-space-card);
        background: var(--eb-color-surface);
        border-bottom: 1px solid var(--eb-color-divider);
      }
      [part='app-nav'] a {
        box-sizing: border-box;
      }
      [part='app-nav'] a svg {
        flex: none;
        width: 16px;
        height: 16px;
      }
      [part='nav-count'] {
        color: var(--eb-color-text-3);
        font-weight: var(--eb-font-weight-medium);
        font-variant-numeric: tabular-nums;
      }
      /* The shared ring cannot reach links the page slots in. */
      ::slotted(:focus-visible) {
        outline: 2px solid var(--eb-color-focus);
        outline-offset: 2px;
      }
      ::slotted(button) {
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      ::slotted(a),
      ::slotted(button),
      [part='app-nav'] a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: var(--eb-size-target);
        min-height: var(--eb-size-target);
        color: var(--eb-color-text);
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }
      ::slotted([data-icon])::before {
        flex: none;
        width: 16px;
        height: 16px;
        background: currentColor;
        mask-position: center;
        mask-repeat: no-repeat;
        mask-size: contain;
      }
      /* On a phone the sidebar's two navs stand in the column on their own: the app's entries a strip
       under the title bar, the page's a tab bar along the bottom. */
      [part='sidebar'] {
        display: contents;
      }
      [part='app-name'] {
        display: none;
      }
      @media (max-width: 599.98px) {
        nav:not([part]) {
          order: 1;
          display: grid;
          grid-auto-columns: minmax(0, 1fr);
          grid-auto-flow: column;
          gap: 0;
          overflow: visible;
          padding: 4px 4px calc(12px + env(safe-area-inset-bottom));
          border-bottom: 0;
          background: var(--eb-color-chrome);
          box-shadow: inset 0 1px 0 var(--eb-color-divider);
        }
        /* While the app's page shows its own bar of actions at its foot, that bar takes the tab
           bar's place. */
        .bottom-bar nav:not([part]) {
          display: none;
        }
        /* A tab is the link's icon at 20 px over its label, one line cut with an ellipsis. */
        ::slotted(a),
        ::slotted(button) {
          display: block;
          align-content: center;
          box-sizing: border-box;
          min-width: 0;
          min-height: 52px;
          padding: 0 4px;
          overflow: hidden;
          color: var(--eb-color-text-2);
          font-size: var(--eb-font-size-caption);
          font-weight: var(--eb-font-weight-medium);
          line-height: var(--eb-line-height-caption);
          text-align: center;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        ::slotted([data-icon])::before {
          display: block;
          width: 20px;
          height: 20px;
          margin: 0 auto 4px;
        }
        ::slotted([aria-current='page']) {
          color: var(--eb-color-text);
          font-weight: var(--eb-font-weight-semibold);
        }
      }
      /* On a phone the app's entries are a strip of words that scrolls sideways, fading at its right
         edge; its end padding lets the last entry scroll clear of the fade. The current entry is in
         text over a 2 px line, as accent is kept for focus. */
      @media (max-width: 599.98px) {
        [part='app-nav'] {
          gap: 20px;
          padding-inline-end: 24px;
          mask-image: linear-gradient(to left, transparent, var(--eb-color-text) 24px);
        }
        [part='app-nav'] a {
          flex: none;
          gap: 4px;
          border-bottom: 2px solid transparent;
          color: var(--eb-color-text-2);
          font-weight: var(--eb-font-weight-medium);
        }
        [part='app-nav'] a[aria-current='page'] {
          border-bottom-color: var(--eb-color-text);
          color: var(--eb-color-text);
          font-weight: var(--eb-font-weight-semibold);
        }
        [part='app-nav'] a svg {
          display: none;
        }
      }
      /* From 600 px the navs are a sidebar of 36 px rows on the chrome surface, left of the title bar
       and the app. */
      @media (min-width: 600px) {
        :host {
          display: grid;
          grid-template-columns: 236px minmax(0, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
        }
        [part='sidebar'] {
          grid-row: 1 / 3;
          grid-column: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-sizing: border-box;
          min-height: 0;
          padding: 12px;
          overflow-y: auto;
          background: var(--eb-color-chrome);
          box-shadow: inset -1px 0 0 var(--eb-color-divider);
        }
        header {
          grid-row: 1;
          grid-column: 2;
          padding: 0 20px;
        }
        .frame {
          grid-row: 2;
          grid-column: 2;
        }
        [part='sidebar'] nav {
          flex-direction: column;
          gap: 4px;
          overflow: visible;
          padding: 0;
          border: 0;
          background: none;
        }
        [part='app-name'] {
          display: block;
          margin: 16px 8px 4px;
          color: var(--eb-color-text-2);
          font-size: var(--eb-font-size-caption);
          font-weight: var(--eb-font-weight-semibold);
          line-height: var(--eb-line-height-caption);
        }
        ::slotted(a),
        ::slotted(button),
        [part='app-nav'] a {
          gap: 8px;
          justify-content: flex-start;
          min-width: 0;
          min-height: var(--eb-size-control-md);
          padding: 0 8px;
          border: 0;
          border-radius: var(--eb-radius-md);
          color: var(--eb-color-text-2);
          font-weight: var(--eb-font-weight-medium);
          text-align: start;
        }
        ::slotted([aria-current='page']),
        [part='app-nav'] a[aria-current='page'] {
          background: var(--eb-color-chrome-active);
          color: var(--eb-color-text);
          font-weight: var(--eb-font-weight-semibold);
        }
        /* One row looks current: while one of the app's pages is, the Admin's entry for the app is not. */
        .app-current ::slotted([aria-current='page']) {
          background: none;
          color: var(--eb-color-text-2);
          font-weight: var(--eb-font-weight-medium);
        }
        [part='app-nav'] a {
          gap: 8px;
        }
        [part='app-nav'] a span:not([part]) {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
      [part='save-bar'] {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      [part='save-bar'] span {
        flex: 1;
        overflow: hidden;
        font-weight: var(--eb-font-weight-semibold);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      /* The title bar's actions are Ink secondary buttons, a full tap target on a phone. */
      header button {
        box-sizing: border-box;
        min-height: var(--eb-size-control-md);
        padding: 0 12px;
        border: 0;
        border-radius: var(--eb-radius-md);
        background: var(--eb-color-surface);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-edge),
          var(--eb-shadow-1);
        color: var(--eb-color-text);
        font: inherit;
        font-weight: var(--eb-font-weight-medium);
        cursor: pointer;
      }
      /* Back is a bare chevron, square, the size of the bar's other buttons. */
      header [part='title-back'] {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: var(--eb-size-control-md);
        padding: 0;
        background: transparent;
        box-shadow: none;
      }
      [part='title-back'] svg {
        width: 20px;
        height: 20px;
      }
      [part='title-action']:hover,
      [part='title-back']:hover {
        background: var(--eb-color-surface-2);
      }
      @media (max-width: 599.98px) {
        header button {
          min-height: var(--eb-size-target);
        }
        header [part='title-back'] {
          width: var(--eb-size-target);
          margin-inline-start: -8px;
        }
      }
      [part='title-action'] {
        flex: none;
        max-width: 40%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      /* An action that opens a menu sits in an eb-menu, which takes the button's place in the bar. */
      header eb-menu {
        flex: none;
        max-width: 40%;
      }
      header eb-menu > [part='title-action'] {
        max-width: 100%;
      }
      header [part='discard'] {
        border: 0;
        background: transparent;
        color: var(--eb-color-on-inverse);
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--eb-color-on-inverse) 24%, transparent);
      }
      header [part='save'] {
        border: 0;
        box-shadow: none;
        background: var(--eb-color-on-inverse);
        color: var(--eb-color-inverse);
      }
      [part='toast'] {
        position: fixed;
        right: 16px;
        bottom: 16px;
        left: 16px;
        display: flex;
        align-items: center;
        gap: var(--eb-space-gap);
        box-sizing: border-box;
        max-width: 480px;
        min-height: var(--eb-size-target);
        margin: 0 auto;
        padding: 8px 8px 8px 16px;
        border-radius: var(--eb-radius-lg);
        --eb-color-focus: var(--eb-color-inverse-act);
        background: var(--eb-color-inverse);
        color: var(--eb-color-on-inverse);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-inverse-edge),
          var(--eb-shadow-3);
        overflow-wrap: anywhere;
      }
      /* The toast fades in; with reduced motion it shows at once. */
      @media (prefers-reduced-motion: no-preference) {
        [part='toast'] {
          transition-property: opacity;
          transition-duration: var(--eb-duration-base);
          transition-timing-function: var(--eb-ease-out);
        }
        @starting-style {
          [part='toast'] {
            opacity: 0;
          }
        }
        [part='toast'].moved {
          transition: none;
        }
      }
      /* On a phone the toast clears the tab bar: its 52 px items, its padding and the safe area. */
      @media (max-width: 599.98px) {
        [part='toast'] {
          bottom: calc(84px + env(safe-area-inset-bottom));
        }
        /* Over a sheet the toast hangs from the top of the screen, on the scrim above the sheet, so it
         covers none of the page in the sheet. On a short screen it overlaps the sheet's header
         rather than leave the screen. */
        [part='modal'] [part='toast'] {
          top: 8px;
          bottom: auto;
        }
      }
      [part='toast'].error {
        background: var(--eb-color-danger);
        color: var(--eb-color-on-danger);
        --eb-color-focus: var(--eb-color-on-danger);
        --eb-color-inverse-act: var(--eb-color-on-danger);
      }
      [part='toast'] span {
        flex: 1;
      }
      /* The words carry the warning icon so it stays with their first line when they wrap: the span
       lays out icon then text from the top, and the margin centres the 16 px icon on that line. */
      [part='toast'] span:has(> svg) {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      [part='toast'] span > svg {
        flex: none;
        width: 16px;
        height: 16px;
        margin-top: calc((1lh - 16px) / 2);
      }
      [part='toast-action'] {
        flex: none;
        min-height: var(--eb-size-target);
        padding: 0 8px;
        border: 0;
        border-radius: var(--eb-radius-sm);
        background: transparent;
        color: var(--eb-color-inverse-act);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      [part='dismiss'] {
        flex: none;
        min-height: var(--eb-size-target);
        padding: 0 12px;
        border: 0;
        border-radius: var(--eb-radius-field);
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      dialog.leave {
        box-sizing: border-box;
        width: min(100% - 32px, 360px);
        padding: var(--eb-space-card);
        border: 0;
        border-radius: var(--eb-radius-card);
        background: var(--eb-color-surface);
        color: var(--eb-color-text);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-overlay-edge),
          var(--eb-shadow-3);
      }
      dialog::backdrop {
        background: var(--eb-color-scrim);
      }
      dialog.leave p {
        margin: 0 0 var(--eb-space-card);
        font-size: var(--eb-font-size-heading-3);
        font-weight: var(--eb-font-weight-semibold);
        line-height: var(--eb-line-height-heading-3);
      }
      dialog.leave div {
        display: flex;
        justify-content: flex-end;
        gap: var(--eb-space-gap);
      }
      dialog.leave button {
        box-sizing: border-box;
        min-height: var(--eb-size-target);
        padding: 0 16px;
        border: 1px solid var(--eb-color-control);
        border-radius: var(--eb-radius-field);
        background: var(--eb-color-surface);
        color: var(--eb-color-text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      dialog.leave [part='stay'] {
        border-color: var(--eb-color-accent);
        background: var(--eb-color-accent);
        color: var(--eb-color-on-primary);
      }
      /* A centred dialog on a wide screen, a sheet docked to the bottom on a phone. */
      [part='modal'] {
        box-sizing: border-box;
        width: min(100% - 32px, 620px);
        max-width: none;
        height: fit-content;
        max-height: none;
        padding: 0;
        border: 0;
        border-radius: var(--eb-radius-card);
        background: var(--eb-color-surface);
        color: var(--eb-color-text);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-overlay-edge),
          var(--eb-shadow-3);
      }
      /* Until its page says how tall it is the modal is open behind its scrim but unseen, so no tap
         lands on a header about to move. */
      [part='modal']:not(.sized) {
        visibility: hidden;
      }
      /* The scrim shows at once all the same, and a tap on it closes the modal. */
      [part='modal']:not(.sized)::backdrop {
        visibility: visible;
      }
      [part='modal'].small {
        width: min(100% - 32px, 380px);
      }
      [part='modal'].large {
        width: min(100% - 32px, 980px);
      }
      /* A phone's sheet shows the handle people know from a sheet that slides up. */
      [part='grab-handle'] {
        display: none;
        flex: none;
        width: 36px;
        height: 4px;
        margin: 8px auto 0;
        border-radius: var(--eb-radius-pill);
        background: var(--eb-color-control);
      }
      @media (max-width: 599.98px) {
        [part='modal'],
        [part='modal'].small,
        [part='modal'].large {
          width: 100%;
          margin: auto 0 0;
          border-radius: var(--eb-radius-card) var(--eb-radius-card) 0 0;
        }
        [part='grab-handle'] {
          display: block;
        }
      }
      /* The sheet slides up from below the screen; with reduced motion it opens at once. It slides
       by its bottom margin, not a transform, which would make it the containing block of a toast
       shown meanwhile, so the toast would ride up inside it. */
      @media (max-width: 599.98px) and (prefers-reduced-motion: no-preference) {
        [part='modal'] {
          transition-property: margin-bottom;
          transition-duration: var(--eb-duration-base);
          transition-timing-function: var(--eb-ease-out);
        }
        @starting-style {
          [part='modal'] {
            margin-bottom: calc(-1 * min(85dvh, 720px));
          }
        }
      }

      /* The modal is as tall as the page it shows, which says how tall it stands, up to the smaller
         of 85% of the window and 720 px; past that the page scrolls inside its frame. Until the
         page has said, its frame stands 0 px tall. */
      [part='modal-body'] {
        display: flex;
        flex-direction: column;
        max-height: min(85dvh, 720px);
      }
      [part='modal-header'] {
        display: flex;
        align-items: center;
        gap: var(--eb-space-gap);
        padding: 0 4px 0 var(--eb-space-card);
        border-bottom: 1px solid var(--eb-color-divider);
      }
      [part='modal-title'] {
        flex: 1;
        overflow: hidden;
        font-size: var(--eb-font-size-heading-3);
        font-weight: var(--eb-font-weight-semibold);
        line-height: var(--eb-line-height-heading-3);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      [part='modal-close'] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--eb-size-target);
        height: var(--eb-size-target);
        padding: 0;
        border: 0;
        border-radius: var(--eb-radius-field);
        background: transparent;
        color: var(--eb-color-text);
        cursor: pointer;
      }
      [part='modal'] iframe {
        flex: 0 1 auto;
        height: 0;
        min-height: 0;
      }
      .frame {
        position: relative;
        flex: 1;
        min-height: 0;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }
      [part='notice'],
      [part='access-ended'] {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: var(--eb-space-card);
        background: var(--eb-color-bg);
        text-align: center;
      }
      [part='notice'] > svg,
      [part='access-ended'] > svg {
        width: 20px;
        height: 20px;
        color: var(--eb-color-text-2);
      }
      [part='notice'] p,
      [part='access-ended'] p {
        margin: 0;
        font-size: var(--eb-font-size-heading-3);
        font-weight: var(--eb-font-weight-semibold);
        line-height: var(--eb-line-height-heading-3);
      }
      [part='notice'] p.help,
      [part='access-ended'] p.help {
        max-width: 40ch;
        color: var(--eb-color-text-2);
        font-size: var(--eb-font-size-body);
        font-weight: var(--eb-font-weight-regular);
        line-height: var(--eb-line-height-body);
      }
      /* The way on is an Ink primary button and the other choice a secondary one; accent is kept
         for focus and links. */
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 8px;
      }
      .actions > * {
        display: inline-flex;
        align-items: center;
        box-sizing: border-box;
        min-height: var(--eb-size-control-md);
        padding: 0 12px;
        border: 0;
        border-radius: var(--eb-radius-md);
        font: inherit;
        font-weight: var(--eb-font-weight-medium);
        text-decoration: none;
        cursor: pointer;
      }
      .actions .primary {
        background: var(--eb-color-primary);
        box-shadow: var(--eb-shadow-button);
        color: var(--eb-color-on-primary);
      }
      .actions .primary:hover {
        background: var(--eb-color-primary-hi);
      }
      .actions .secondary {
        background: var(--eb-color-surface);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-edge),
          var(--eb-shadow-1);
        color: var(--eb-color-text);
      }
      .actions .secondary:hover {
        background: var(--eb-color-surface-2);
      }
      @media (max-width: 640px) {
        .actions > * {
          min-height: var(--eb-size-target);
        }
      }
      /* Until the app is ready its frame is hidden, so none of its unstyled words show, and skeleton
         blocks stand in its place: a heading and two cards on the ground. */
      iframe.waiting {
        visibility: hidden;
      }
      [part='skeleton'] {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        gap: var(--eb-space-card);
        padding: var(--eb-space-card);
        overflow: hidden;
        background: var(--eb-color-bg);
      }
      [part='skeleton'] .heading {
        width: 40%;
      }
      [part='skeleton'] .block {
        padding: var(--eb-space-card);
        border-radius: var(--eb-radius-card);
        background: var(--eb-color-surface);
        box-shadow: inset 0 0 0 1px var(--eb-color-edge);
      }
      [part='loading-bar'] {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        height: 3px;
        overflow: hidden;
        background: var(--eb-color-divider);
      }
      [part='loading-bar']::after {
        position: absolute;
        inset: 0;
        width: 40%;
        background: var(--eb-color-accent);
        content: '';
        animation: slide 1.2s ease-in-out infinite;
      }
      @keyframes slide {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(250%);
        }
      }
    `,
    slottedIcons,
  ]

  /** The address of the app's first page, which the chrome shows in a frame. Its origin is the only one the chrome trusts. */
  declare src: string
  /** The app's name, shown above its navigation. */
  declare appName: string
  /** Where the chrome mints the app's ID tokens. */
  declare tokenUrl: string
  /** The API the app's ID tokens open. */
  declare apiUrl: string
  /** The store picker, where a staff member whose access has ended goes next. */
  declare storesUrl: string
  declare private accessEnded: boolean
  declare private frameSrc: string
  declare private appPage: string
  declare private appNav: { label: string; url: string; icon: SVGTemplateResult | null; count: number | null }[]
  declare private answered: boolean
  declare private ready: boolean
  declare private busy: boolean
  declare private bottomBar: boolean
  declare private stalled: boolean
  private answerTimer = 0
  declare private appTitle: string
  // menus lines up with labels: the items of an action that opens a menu, or null for a button.
  declare private titleActions: { labels: string[]; menus: (TitleMenuItem[] | null)[]; call: number }
  // The page the back button before the title opens, on the app's origin, or none.
  declare private titleBack: string | null
  declare private saveBar: boolean
  declare private toast: {
    message: string
    error: boolean
    action: { label: string; call: number; from: Window | null } | null
    shown: number
  } | null
  private toastTimer = 0
  private toastsShown = 0
  // Where the toast last drew. It fades in once; when the modal opens or closes it is drawn afresh
  // in the other place, and shows there at once rather than fade in again.
  private toastDrawn = { shown: 0, place: '', moved: false }
  declare private modal: { url: string; size: string; title: string; height: number | null } | null
  // What had focus when the modal opened, which gets it back when the modal closes.
  private opener: HTMLElement | null = null
  // The app's last ID token and when, by this page's clock, to stop handing it out.
  private token: { value: string; until: number } | null = null
  private minting: Promise<string> | null = null

  constructor() {
    super()
    this.src = ''
    this.appName = ''
    this.tokenUrl = ''
    this.apiUrl = ''
    this.storesUrl = 'https://admin.ebdfy.com/'
    this.accessEnded = false
    this.frameSrc = ''
    this.appNav = []
    this.appPage = ''
    this.answered = false
    this.ready = false
    this.busy = false
    this.bottomBar = false
    this.stalled = false
    this.appTitle = ''
    this.titleActions = { labels: [], menus: [], call: 0 }
    this.titleBack = null
    this.saveBar = false
    this.toast = null
    this.modal = null
  }

  // Where a navigation link goes once the person agrees to leave.
  private leaving = (): void => {}

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('src') || changed.has('tokenUrl')) this.token = null
    if (changed.has('src')) this.frameSrc = this.src
    if (changed.has('frameSrc')) {
      this.appPage = this.frameSrc
      this.waitForAnswer()
    }
  }

  override updated(changed: PropertyValues): void {
    const dialog = this.modalDialog()
    // The dialog opens when a modal comes where there was none. A new height for a modal on its way
    // out, as its page reports once the dialog hides it, must not open it again.
    if (changed.has('modal') && !changed.get('modal') && dialog && !dialog.open) dialog.showModal()
    // An unseen close button cannot take focus as the dialog opens, so it takes it once the modal shows.
    // SAFETY: Lit's map of changes holds each changed property's last value, here the modal's.
    const was = changed.get('modal') as EbAdminChrome['modal'] | undefined
    if (was?.height === null && this.modal && this.modal.height !== null) this.closeButton()?.focus()
  }

  private appFrame(): HTMLIFrameElement | null {
    return this.shadowRoot?.querySelector('.frame iframe') ?? null
  }

  private modalDialog(): HTMLDialogElement | null {
    return this.shadowRoot?.querySelector('dialog[part="modal"]') ?? null
  }

  private closeButton(): HTMLButtonElement | null {
    return this.shadowRoot?.querySelector('[part="modal-close"]') ?? null
  }

  private leaveDialog(): HTMLDialogElement | null {
    return this.shadowRoot?.querySelector('dialog.leave') ?? null
  }

  // Only a path on the app's own origin opens, so an app cannot frame another site in the chrome.
  private openModal(options: ModalOptions | undefined): void {
    const url = this.pageUrl(String(options?.src ?? ''))
    if (!url) return
    const size = modalSizes.has(String(options?.size)) ? String(options?.size) : 'medium'
    if (!this.modal) this.opener = focused()
    this.modal = { url, size, title: String(options?.title ?? ''), height: null }
    // A page that has not said how tall it is 2 s on, as one without v1.js or on a slow network,
    // shows at the tallest; a later word from it fits the modal to it after all.
    clearTimeout(this.sizeTimer)
    this.sizeTimer = window.setTimeout(() => this.modal?.height === null && this.fitModal(window.innerHeight), 2000)
  }

  private sizeTimer = 0

  // The height the page in the modal stands, in CSS pixels, which its frame takes.
  private fitModal(height: number): void {
    if (this.modal && Number.isFinite(height) && height > 0) this.modal = { ...this.modal, height: Math.ceil(height) }
  }

  private closeModal(): void {
    this.modalDialog()?.close()
  }

  // Every way the modal closes ends here, with focus back where it was. When that was the app's
  // frame, the app puts it back on its own button.
  private modalClosed = (): void => {
    // The page in the modal is gone, so an action its toast offered can no longer run.
    const toast = this.toast
    if (toast?.action && toast.action.from !== this.appFrame()?.contentWindow) this.toast = { ...toast, action: null }
    this.modal = null
    const opener = this.opener
    this.opener = null
    if (!opener?.isConnected) return
    opener.focus()
    if (opener === this.appFrame()) this.send({ type: 'modalClosed' })
  }

  // The theme the chrome wears, from data-theme on any element around it or else the device.
  private theme(): 'light' | 'dark' {
    return getComputedStyle(this).colorScheme === 'dark' ? 'dark' : 'light'
  }

  // Tells the app and the page in its modal a new theme, once per change.
  private themeSent: 'light' | 'dark' | null = null
  private themeChanged = (): void => {
    const theme = this.theme()
    if (theme === this.themeSent) return
    this.themeSent = theme
    const message: HostMessage = { type: 'theme', payload: { theme } }
    const origin = new URL(this.src, location.href).origin
    for (const frame of [this.appFrame(), this.modalDialog()?.querySelector('iframe')]) {
      frame?.contentWindow?.postMessage(message, origin)
    }
  }

  private themeWatch = new MutationObserver(this.themeChanged)
  // Under 600 px the modal is a sheet, and its frame's name tells the page so.
  private narrow = matchMedia('(max-width: 599.98px)')
  private narrowChanged = (): void => this.requestUpdate()
  private darkDevice = matchMedia('(prefers-color-scheme: dark)')

  override connectedCallback(): void {
    super.connectedCallback()
    this.themeSent = this.theme()
    this.themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    this.darkDevice.addEventListener('change', this.themeChanged)
    this.narrow.addEventListener('change', this.narrowChanged)
    window.addEventListener('message', this.receive)
    window.addEventListener('blur', this.blurred)
    window.addEventListener('beforeunload', this.unload)
    this.addEventListener('click', this.navigate)
  }

  // Every page the chrome loads has 15 s to answer before the notice replaces it.
  private waitForAnswer(): void {
    this.answered = false
    this.ready = false
    this.busy = false
    this.bottomBar = false
    this.stalled = false
    clearTimeout(this.answerTimer)
    this.answerTimer = window.setTimeout(() => (this.stalled = !this.answered), answerSeconds * 1000)
  }

  private reload(): void {
    this.waitForAnswer()
    const frame = this.appFrame()
    if (frame) frame.src = this.frameSrc
  }

  override disconnectedCallback(): void {
    this.themeWatch.disconnect()
    this.darkDevice.removeEventListener('change', this.themeChanged)
    this.narrow.removeEventListener('change', this.narrowChanged)
    clearTimeout(this.sizeTimer)
    clearTimeout(this.answerTimer)
    window.removeEventListener('message', this.receive)
    window.removeEventListener('blur', this.blurred)
    window.removeEventListener('beforeunload', this.unload)
    this.removeEventListener('click', this.navigate)
    super.disconnectedCallback()
  }

  // A press in the app's page lands in another document, which a title menu's light dismiss never
  // hears; the Admin's window loses focus to it, and the menu closes.
  private blurred = (): void => {
    for (const menu of this.renderRoot.querySelectorAll<EbMenu>('eb-menu[open]')) menu.open = false
  }

  // A reload or a closed tab while the bar is up gets the browser's own question.
  private unload = (event: BeforeUnloadEvent): void => {
    if (this.saveBar) event.preventDefault()
  }

  // A navigation link while the bar is up asks before it goes.
  private navigate = (event: MouseEvent): void => {
    const link = event.target instanceof Element ? event.target.closest('a[slot="nav"]') : null
    if (!this.saveBar || !(link instanceof HTMLAnchorElement)) return
    event.preventDefault()
    this.leaving = () => location.assign(link.href)
    this.leaveDialog()?.showModal()
  }

  // An app's nav entry loads its page in the frame, asking first while the bar is up.
  private openPage(event: MouseEvent, url: string): void {
    event.preventDefault()
    if (!this.saveBar) {
      this.show(url)
      return
    }
    this.leaving = () => this.show(url)
    this.leaveDialog()?.showModal()
  }

  // Loads a page in the frame. The page already there loads again, since the frame's src does not
  // change, and with it go any edits the person chose to leave.
  private show(url: string): void {
    if (url === this.frameSrc) this.reload()
    else this.frameSrc = url
  }

  // A path on the app's own origin, keeping the frame's query (the store) when it names none.
  private pageUrl(path: string): string | null {
    if (!path.startsWith('/')) return null
    const src = new URL(this.src, location.href)
    const url = new URL(path, src)
    if (url.origin !== src.origin) return null
    if (!url.search) url.search = src.search
    return url.href
  }

  // The page a ready app names, when it is on the app's origin; a 1.0.0 bridge names none, and the
  // page the chrome loaded stands.
  private ownPage(page: string): string {
    const src = new URL(this.src, location.href)
    const url = URL.canParse(page) ? new URL(page) : null
    return url?.origin === src.origin ? url.href : this.frameSrc
  }

  private setNav(entries: NavEntry[] | undefined): void {
    const list = Array.isArray(entries) ? entries : []
    this.appNav = list.slice(0, navLimit).flatMap((entry) => {
      const url = this.pageUrl(String(entry?.path ?? ''))
      const label = String(entry?.label ?? '').trim()
      const icon = String(entry?.icon ?? '')
      const count = Number(entry?.count)
      return url && label
        ? [
            {
              label: cut(label, navLabelLimit),
              url,
              icon: navIcons.get(icon) ?? null,
              count: Number.isInteger(count) && count >= 0 ? count : null,
            },
          ]
        : []
    })
  }

  private setTitle(
    payload:
      | { title?: unknown; actions?: unknown; menus?: (TitleMenuItem[] | null)[]; call?: unknown; back?: unknown }
      | undefined,
  ): void {
    this.appTitle = cutTitle(String(payload?.title ?? ''))
    this.titleBack = payload?.back === undefined ? null : this.pageUrl(String(payload.back))
    const labels = Array.isArray(payload?.actions) ? payload.actions.slice(0, titleActionLimit).map(String) : []
    const menus = Array.isArray(payload?.menus) ? payload.menus : []
    this.titleActions = {
      labels,
      menus: labels.map((_, index) => menuItems(menus[index])),
      call: Number(payload?.call),
    }
  }

  // One token serves every call until 10 s before it dies. Its lifetime is timed from the mint by
  // this page's clock, never by its exp, so a server clock out of step cannot keep a dead token.
  private idToken(): Promise<string> {
    if (this.token && Date.now() < this.token.until) return Promise.resolve(this.token.value)
    this.minting ??= this.mint().finally(() => (this.minting = null))
    return this.minting
  }

  private async mint(): Promise<string> {
    const minted = Date.now()
    const response = await fetch(new URL(this.tokenUrl, location.href), { method: 'POST' })
    if (!response.ok) throw new Error(response.status === 403 ? 'ACCESS_ENDED' : `HTTP ${response.status}`)
    // SAFETY: the token endpoint answers a 2xx with {token}, a JWT whose claims hold iat and exp.
    const { token } = (await response.json()) as { token: string }
    const segment = token.split('.')[1] ?? ''
    // SAFETY: as above, the second segment of the JWT is its claims as base64url JSON.
    const claims = JSON.parse(atob(segment.replaceAll('-', '+').replaceAll('_', '/'))) as { iat: number; exp: number }
    this.token = { value: token, until: minted + (claims.exp - claims.iat - 10) * 1000 }
    return token
  }

  // Answers the page that asked, the app or the page in its modal, on the app's origin only.
  private async answerToken(source: Window | null, id: number): Promise<void> {
    const reply: IdTokenAnswer = { id }
    try {
      reply.token = await this.idToken()
      reply.api = new URL(this.apiUrl, location.href).href
    } catch (error) {
      reply.error = error instanceof Error ? error.message : String(error)
    }
    const message: HostMessage = { type: 'idToken', payload: reply }
    source?.postMessage(message, new URL(this.src, location.href).origin)
    if (reply.error === 'ACCESS_ENDED') this.endAccess()
  }

  // The staff member may no longer use this store: the app goes, with its modal, and the notice
  // takes its place.
  private endAccess(): void {
    this.closeModal()
    clearTimeout(this.answerTimer)
    this.stalled = false
    this.accessEnded = true
    // The app's title, its actions, its way back, its nav and its bar of actions belong to a page
    // that is gone, so the tab bar that bar hid comes back.
    this.appTitle = ''
    this.titleActions = { labels: [], menus: [], call: 0 }
    this.titleBack = null
    this.appNav = []
    this.bottomBar = false
  }

  // Access may have come back, so the app loads afresh and asks for a new token.
  private tryAgain(): void {
    this.token = null
    this.accessEnded = false
    this.waitForAnswer()
  }

  private answer(leave: boolean): void {
    this.leaveDialog()?.close()
    if (!leave) return
    this.saveBar = false
    this.leaving()
  }

  // Only the app's own frame, from the origin its URL names, can change the chrome.
  private receive = (event: MessageEvent<BridgeMessage>): void => {
    if (event.origin !== new URL(this.src, location.href).origin) return
    // The page in the modal may only close it, ask for a token and show a toast.
    const sheet = this.modalDialog()?.querySelector('iframe')
    if (sheet && event.source === sheet.contentWindow) {
      if (event.data?.type === 'modalClose') this.closeModal()
      if (event.data?.type === 'modalHeight') this.fitModal(Number(event.data.payload?.height))
      if (event.data?.type === 'ready') this.tellTheme(sheet.contentWindow)
      if (event.data?.type === 'idToken') void this.answerToken(sheet.contentWindow, Number(event.data.payload?.id))
      if (event.data?.type === 'toast') this.showToast(event.data.payload, sheet.contentWindow)
      return
    }
    const frame = this.appFrame()
    if (!frame || event.source !== frame.contentWindow) return
    this.answered = true
    this.stalled = false
    if (event.data?.type === 'loading') this.busy = event.data.payload?.visible === true
    if (event.data?.type === 'title') this.setTitle(event.data.payload)
    if (event.data?.type === 'nav') this.setNav(event.data.payload?.entries)
    if (event.data?.type === 'saveBar') this.saveBar = event.data.payload?.visible === true
    if (event.data?.type === 'bottomBar') this.bottomBar = event.data.payload?.visible === true
    if (event.data?.type === 'modal') this.openModal(event.data.payload)
    if (event.data?.type === 'modalClose') this.closeModal()
    if (event.data?.type === 'ready') {
      this.ready = true
      this.appPage = this.ownPage(String(event.data.payload?.page ?? ''))
      this.tellTheme(frame.contentWindow)
    }
    if (event.data?.type === 'idToken') void this.answerToken(frame.contentWindow, Number(event.data.payload?.id))
    if (event.data?.type === 'toast') this.showToast(event.data.payload, frame.contentWindow)
  }

  // One toast at a time: a new one takes the place of the last. Errors stay until dismissed. The
  // action's press goes back to the window the toast came from, the app or the page in the modal.
  // A toast with no words has nothing to say and shows nothing.
  private showToast(payload: Extract<BridgeMessage, { type: 'toast' }>['payload'] | undefined, from: Window | null) {
    if (!String(payload?.message ?? '').trim()) return
    clearTimeout(this.toastTimer)
    const error = payload?.error === true
    const label = cut(String(payload?.action ?? '').trim(), navLabelLimit)
    this.toast = {
      message: cut(String(payload?.message ?? ''), toastLimit),
      error,
      action: label ? { label, call: Number(payload?.call), from } : null,
      shown: ++this.toastsShown,
    }
    if (!error) this.toastTimer = window.setTimeout(() => (this.toast = null), toastSeconds * 1000)
  }

  private pressToastAction(): void {
    const action = this.toast?.action
    this.toast = null
    const message: HostMessage = { type: 'toastAction', payload: { call: action?.call ?? 0 } }
    action?.from?.postMessage(message, new URL(this.src, location.href).origin)
  }

  private renderToast(place: 'chrome' | 'modal') {
    if (!this.toast) return nothing
    const { message, error, action, shown } = this.toast
    const drawn = this.toastDrawn
    if (drawn.shown !== shown) this.toastDrawn = { shown, place, moved: false }
    else if (drawn.place !== place) this.toastDrawn = { shown, place, moved: true }
    const dismiss = html`<button part="dismiss" type="button" @click=${() => (this.toast = null)}>
      ${this.words().dismiss}
    </button>`
    const press = action
      ? html`<button part="toast-action" type="button" @click=${() => this.pressToastAction()}>${action.label}</button>`
      : nothing
    const kind = [error ? 'error' : '', this.toastDrawn.moved ? 'moved' : ''].filter(Boolean).join(' ')
    return html`<div part="toast" class=${kind} role=${error ? 'alert' : 'status'}>
      <span>${error ? triangleAlert : nothing}${message}</span>${press}${error ? dismiss : nothing}
    </div>`
  }

  // A page that has just loaded hears the theme it is to wear.
  private tellTheme(source: Window | null): void {
    const message: HostMessage = { type: 'theme', payload: { theme: this.theme() } }
    source?.postMessage(message, new URL(this.src, location.href).origin)
  }

  // Posts to the app's frame, and only to the origin its URL names.
  private send(message: HostMessage): void {
    this.appFrame()?.contentWindow?.postMessage(message, new URL(this.src, location.href).origin)
  }

  private words() {
    return words[document.documentElement.lang.startsWith('bn') ? 'bn' : 'en']
  }

  private header() {
    if (!this.saveBar) {
      const { labels, menus, call } = this.titleActions
      const back = this.titleBack
      return html`${
          back
            ? html`<button
                part="title-back"
                type="button"
                aria-label=${this.words().back}
                @click=${(event: MouseEvent) => this.openPage(event, back)}
              >
                ${chevronLeft}
              </button>`
            : nothing
        }<span part="title">${this.appTitle}</span>${labels.map((label, index) => {
          const items = menus[index]
          if (!items)
            return html`<button
              part="title-action"
              type="button"
              @click=${() => this.send({ type: 'titleAction', payload: { call, index } })}
            >
              ${label}
            </button>`
          // Keyed by the title call, so a new title brings a new menu and closes one left open.
          return keyed(
            call,
            html`<eb-menu label=${label}>
              <button slot="trigger" part="title-action" type="button">${label}</button>
              ${items.map(
                (item, at) =>
                  html`<eb-menu-item
                    tone=${item.tone ?? 'default'}
                    @click=${() => this.send({ type: 'titleAction', payload: { call, index, item: at } })}
                    >${item.label}</eb-menu-item
                  >`,
              )}
            </eb-menu>`,
          )
        })}`
    }
    const t = this.words()
    return html`<div part="save-bar" role="region" aria-label=${t.unsaved}>
      <span>${t.unsaved}</span>
      <button
        part="discard"
        type="button"
        @click=${() => this.send({ type: 'saveBar', payload: { action: 'discard' } })}
      >
        ${t.discard}
      </button>
      <button part="save" type="button" @click=${() => this.send({ type: 'saveBar', payload: { action: 'save' } })}>
        ${t.save}
      </button>
    </div>`
  }

  private renderNotice() {
    const t = this.words()
    return html`<div part="notice" role="alert">
      ${triangleAlert}
      <p>${t.stalled}</p>
      <p class="help">${t.stalledHelp}</p>
      <div class="actions">
        <button part="reload" class="primary" type="button" @click=${() => this.reload()}>${t.reload}</button>
        <button part="keep-waiting" class="secondary" type="button" @click=${() => this.waitForAnswer()}>
          ${t.keepWaiting}
        </button>
      </div>
    </div>`
  }

  private renderFrame() {
    const t = this.words()
    return html`<iframe
        class=${this.ready ? '' : 'waiting'}
        src=${this.frameSrc}
        title=${this.appTitle}
        @load=${() => this.closeModal()}
      ></iframe>
      ${this.stalled ? this.renderNotice() : nothing}
      ${
        !this.stalled && !this.ready
          ? html`<div part="skeleton" role="progressbar" aria-label=${t.loading}>
              <eb-skeleton class="heading"></eb-skeleton>
              <div class="block"><eb-skeleton lines="3"></eb-skeleton></div>
              <div class="block"><eb-skeleton lines="2"></eb-skeleton></div>
            </div>`
          : nothing
      }
      ${
        !this.stalled && this.ready && this.busy
          ? html`<div part="loading-bar" role="progressbar" aria-label=${t.loading}></div>`
          : nothing
      }`
  }

  private renderAccessEnded() {
    const t = this.words()
    return html`<div part="access-ended" role="alert">
      ${icons.lock}
      <p>${t.accessEnded}</p>
      <p class="help">${t.accessHelp}</p>
      <div class="actions">
        <a part="choose-store" class="primary" href=${this.storesUrl}>${t.chooseStore}</a>
        <button part="try-again" class="secondary" type="button" @click=${() => this.tryAgain()}>${t.tryAgain}</button>
      </div>
    </div>`
  }

  private renderAppNav() {
    if (!this.appNav.length) return nothing
    return html`<nav part="app-nav" aria-label=${this.appName}>
      ${this.appName ? html`<span part="app-name" aria-hidden="true">${this.appName}</span>` : nothing}
      ${this.appNav.map(
        ({ label, url, icon, count }) =>
          html`<a
            href=${url}
            aria-current=${url === this.appPage ? 'page' : nothing}
            @click=${(event: MouseEvent) => this.openPage(event, url)}
            >${icon ?? nothing}<span>${label}</span>${
              count === null ? nothing : html`<span part="nav-count">${digits(count)}</span>`
            }</a
          >`,
      )}
    </nav>`
  }

  private renderModal() {
    if (!this.modal) return nothing
    const { url, size, title, height } = this.modal
    const label = title || this.appTitle
    // A tap on the backdrop lands on the dialog itself, since its body fills the box. Tab past either
    // end lands on a stop that wraps round, as the browser would otherwise leave for its own toolbar.
    // An open modal makes the rest of the chrome inert, so the toast draws inside it meanwhile.
    return html`<dialog
      part="modal"
      class=${height === null ? size : `${size} sized`}
      aria-label=${label}
      @close=${this.modalClosed}
      @click=${(event: MouseEvent) => event.target === event.currentTarget && this.closeModal()}
    >
      <div part="modal-body">
        <span
          tabindex="0"
          aria-hidden="true"
          @focus=${() => this.modalDialog()?.querySelector('iframe')?.focus()}
        ></span>
        <span part="grab-handle" aria-hidden="true"></span>
        <div part="modal-header">
          <span part="modal-title">${title}</span>
          <button
            part="modal-close"
            type="button"
            autofocus
            aria-label=${this.words().close}
            @click=${() => this.closeModal()}
          >
            ${close}
          </button>
        </div>
        <iframe
          src=${url}
          title=${label}
          name=${this.narrow.matches ? 'ebdfy-sheet' : 'ebdfy-dialog'}
          style=${height === null ? nothing : `height: ${height}px`}
        ></iframe>
        ${this.renderToast('modal')}
        <span tabindex="0" aria-hidden="true" @focus=${() => this.closeButton()?.focus()}></span>
      </div>
    </dialog>`
  }

  override render() {
    const t = this.words()
    return html`<header>${this.header()}</header>
      <div
        part="sidebar"
        class=${[
          this.appNav.some(({ url }) => url === this.appPage) ? 'app-current' : '',
          this.bottomBar ? 'bottom-bar' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <nav><slot name="nav"></slot></nav>
        ${this.renderAppNav()}
      </div>
      <div class="frame">${this.accessEnded ? this.renderAccessEnded() : this.renderFrame()}</div>
      ${this.modal ? nothing : this.renderToast('chrome')} ${this.renderModal()}
      <dialog class="leave" aria-labelledby="leave-ask">
        <p id="leave-ask">${t.leaveAsk}</p>
        <div>
          <button part="leave" type="button" @click=${() => this.answer(true)}>${t.leave}</button>
          <button part="stay" type="button" autofocus @click=${() => this.answer(false)}>${t.stay}</button>
        </div>
      </dialog>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-admin-chrome': EbAdminChrome
  }
}

installTokens()
installFonts()
// The chrome draws its waiting blocks with eb-skeleton, which the Admin's page has without v1.js.
if (!customElements.get('eb-skeleton')) customElements.define('eb-skeleton', EbSkeleton)
// A title action with items opens an eb-menu.
if (!customElements.get('eb-menu')) customElements.define('eb-menu', EbMenu)
if (!customElements.get('eb-menu-item')) customElements.define('eb-menu-item', EbMenuItem)
if (!customElements.get('eb-admin-chrome')) customElements.define('eb-admin-chrome', EbAdminChrome)
