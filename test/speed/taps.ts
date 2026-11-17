// What the speed checks tap and wait for on the sample pages. The speed checks run before a release,
// not on every landing, so test/node/speed-taps.test.ts finds each of these on its page in the fast
// suite: a page that drops one fails there, not first at the release.
import type { Frame, Page } from 'playwright'

type Where = Page | Frame

// A menu entry or More's sheet entry whose whole text is the name.
const exactly = (name: string) => new RegExp(`^${name}$`)

export const taps = {
  // The sample app's orders list: the link into order #1042.
  orderLink: (app: Where) => app.getByRole('link', { name: '#1042' }),
  // The sample app's order #1042: its items card, and the link back to the list.
  itemsCard: (app: Where) => app.locator('#items-card'),
  orderBack: (app: Where) => app.locator('e-page > a[slot="back"]'),
  // The Admin's panel heading, which a swap replaces.
  heading: (page: Where) => page.locator('e-admin-panel > header h1'),
  // Settings on a phone: the tab bar's More, and an entry in its sheet.
  more: (page: Where) => page.locator('[slot="tabs"] > button'),
  inMore: (page: Where, name: string) => page.locator('#e-more > a').filter({ hasText: exactly(name) }),
  // Settings from 1040 px: an entry in the menu.
  inMenu: (page: Where, name: string) => page.locator('[slot="menu"] > a').filter({ hasText: exactly(name) }),
  // The docs: the sidebar's link to Card.
  cardLink: (page: Where) => page.locator('.sidebar a[href="/components/card"]'),
}
