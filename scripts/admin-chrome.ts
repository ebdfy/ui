// The Admin's chrome around the playground's panel: the store, the menu, the phone's tab bar, the
// search and the top band's actions. Every playground page names it with %EB_ADMIN_CHROME%, and this
// draws it for the page's own address, so the menu's current entry and Settings' own menu are in the
// markup before any script runs. Words are English with their Bangla in data-bn, and an attribute's
// Bangla in data-bn-<attribute>; the playground's playground.js puts them in place in bn.
import {
  type AdminPage,
  contentPagePath,
  contentPages,
  isContentPage,
  isReportsPage,
  ordersPages,
  productPath,
  productsImportPath,
  reportsPath,
  settingsPages,
} from '../src/playground-admin.ts'

const words = (en: string, bn: string) => `<span data-bn="${bn}">${en}</span>`
const icon = (name: string) => `<e-icon name="${name}"></e-icon>`

// aria-current: 'page' on the page itself, 'true' on the area it belongs to.
function link(href: string, inner: string, current?: 'page' | 'true', extra = ''): string {
  return `<a href="${href}"${current ? ` aria-current="${current}"` : ''}${extra}>${inner}</a>`
}

const mainEntries = [
  { href: '/playground/home', en: 'Home', bn: 'হোম', icon: 'home' },
  { href: '/playground/orders', en: 'Orders', bn: 'অর্ডার', icon: 'shopping-bag' },
  { href: productsImportPath, en: 'Products', bn: 'পণ্য', icon: 'package' },
  { href: '/playground', en: 'Customers', bn: 'গ্রাহক', icon: 'users' },
  { href: contentPagePath, en: 'Content', bn: 'কনটেন্ট', icon: 'file-text' },
  { href: reportsPath, en: 'Reports', bn: 'রিপোর্ট', icon: 'chart-column' },
]

// A product's page is the Admin's own too, under Products, which leads to Import.
const ownArea = (path: string) =>
  isReportsPage(path) || isContentPage(path) || path === productsImportPath || path === productPath

// An area of the Admin's own, as the frame marks it: its entry is the page itself, or "true" on a
// page under it. Every other page under /playground is the sample app's, which stands for Orders.
function areaMark(href: string, path: string): 'page' | 'true' | undefined {
  if (href === path && ownArea(path)) return 'page'
  if (href === reportsPath && isReportsPage(path)) return 'true'
  if (href === contentPagePath && isContentPage(path)) return 'true'
  if (href === productsImportPath && path === productPath) return 'true'
  return undefined
}

function mainMenu(path: string): string {
  const sub = ordersPages.find((page) => page.path === path)
  // The sample app's pages stand for the Orders area, so Orders is current on all of them. Reports,
  // Products and Content are areas of their own: the page itself, or the area on a page under it.
  const ordersCurrent = sub ? 'true' : ownArea(path) ? undefined : 'page'
  const rail = (pages: AdminPage[]) =>
    `<div class="e-menu-pages">${pages.map((page) => link(page.path, words(page.en, page.bn), page.path === path ? 'page' : undefined)).join('')}</div>`
  const entries = mainEntries.map((entry) => {
    const inner = `${icon(entry.icon)}${words(entry.en, entry.bn)}`
    if (entry.en === 'Content') return `${link(entry.href, inner, areaMark(entry.href, path))}${rail(contentPages)}`
    if (entry.en !== 'Orders') return link(entry.href, inner, areaMark(entry.href, path))
    return `${link(entry.href, inner, ordersCurrent, ' count="3" data-bn-count="৩"')}${rail(ordersPages)}`
  })
  return `<nav slot="menu" aria-label="Main" data-bn-aria-label="প্রধান">${entries.join('')}<p class="e-menu-label">${words('Installed apps', 'ইনস্টল করা অ্যাপ')}</p>${link('/playground', `<span class="e-tile" data-size="20" aria-hidden="true">S</span>${words('Sample app', 'স্যাম্পল অ্যাপ')}`, undefined, ' data-app="sample"')}${link('/playground/settings/store', `${icon('settings')}${words('Settings', 'সেটিংস')}`)}</nav>`
}

function settingsMenu(here: AdminPage | undefined): string {
  const entries = settingsPages.map((page) =>
    link(page.path, `${icon(page.icon ?? 'settings')}${words(page.en, page.bn)}`, page === here ? 'page' : undefined),
  )
  return `<nav slot="menu" aria-label="Settings" data-bn-aria-label="সেটিংস">${link('/playground/home', `${icon('arrow-left')}${words('Back', 'ফিরে যান')}`, undefined, ' data-back')}<p class="e-menu-label">${words('Settings', 'সেটিংস')}</p>${entries.join('')}</nav>`
}

// The staff member signed in, and what they can do as themselves: the user menu's items, which on
// a phone open from More.
function userItems(): string {
  const language = `<div class="e-language" role="group" aria-label="Language" data-bn-aria-label="ভাষা"><button type="button" data-lang="en" lang="en" aria-pressed="true">English</button><button type="button" data-lang="bn" lang="bn" aria-pressed="false">বাংলা</button></div>`
  return `<p class="e-user-name">Rafiq Ahmed<small>${words('Owner', 'মালিক')}</small></p>${language}${link('/playground/settings/account', words('Account and security', 'অ্যাকাউন্ট ও নিরাপত্তা'))}${link('/playground', words('Switch store', 'স্টোর বদলান'))}${link('/', words('Log out', 'লগ আউট'))}`
}

// Below 1040 px the menu gives way to a tab bar of the three areas staff open most, and More, whose
// sheet holds the other areas, the installed apps, the current area's pages and the user's items.
function tabs(path: string): string {
  const settings = path.startsWith('/playground/settings/')
  // As in the menu, Orders is the page itself on the sample app's pages and the area on its sub-pages.
  const orders = ordersPages.some((page) => page.path === path) ? 'true' : 'page'
  const mark = (entry: (typeof mainEntries)[number]) =>
    entry.en === 'Orders' ? (settings || ownArea(path) ? undefined : orders) : areaMark(entry.href, path)
  const entries = mainEntries
    .slice(0, 3)
    .map((entry) => link(entry.href, `${icon(entry.icon)}${words(entry.en, entry.bn)}`, mark(entry)))
  const others = mainEntries
    .slice(3)
    .map((entry) => link(entry.href, `${icon(entry.icon)}${words(entry.en, entry.bn)}`, mark(entry)))
  // The areas' pages, under each area's label: Settings' on a Settings page, else Orders' and
  // Content's, the same on every page so a swap between them keeps the sheet true.
  const areas = settings
    ? [{ label: words('Settings', 'সেটিংস'), pages: settingsPages }]
    : [
        { label: words('Orders', 'অর্ডার'), pages: ordersPages },
        { label: words('Content', 'কনটেন্ট'), pages: contentPages },
      ]
  const sub = areas.map(
    (area) =>
      `<p class="e-menu-label">${area.label}</p>${area.pages
        .map((page) =>
          link(
            page.path,
            `${page.icon ? icon(page.icon) : ''}${words(page.en, page.bn)}`,
            page.path === path ? 'page' : undefined,
          ),
        )
        .join('')}`,
  )
  const sheet = `<div id="e-more" popover class="e-more">${others.join('')}<p class="e-menu-label">${words('Installed apps', 'ইনস্টল করা অ্যাপ')}</p>${link('/playground', `<span class="e-tile" data-size="20" aria-hidden="true">S</span>${words('Sample app', 'স্যাম্পল অ্যাপ')}`)}${sub.join('')}${settings ? '' : link('/playground/settings/store', `${icon('settings')}${words('Settings', 'সেটিংস')}`)}<hr />${userItems()}</div>`
  return `<nav slot="tabs" aria-label="Main" data-bn-aria-label="প্রধান">${entries.join('')}<button type="button" popovertarget="e-more">${icon('more-horizontal')}${words('More', 'আরও')}</button>${sheet}</nav>`
}

export function adminChrome(path: string): string {
  const settings = path.startsWith('/playground/settings/')
  const store = `<div slot="store"><span class="e-tile" aria-hidden="true">D</span><span>${words('Demo shop', 'ডেমো শপ')}<small>demo-shop.ebdfy.com</small></span></div>`
  // The search modal, which the search button and Ctrl+K open; playground.js fills its results.
  const search = `<dialog class="e-search" aria-label="Search" data-bn-aria-label="খুঁজুন"><div role="search">${icon('search')}<input type="search" name="q" aria-label="Search" data-bn-aria-label="খুঁজুন" placeholder="Search orders, products, customers" data-bn-placeholder="অর্ডার, পণ্য, গ্রাহক খুঁজুন" autocomplete="off" /></div><div class="e-search-results"></div></dialog>`
  // Only the app page can frame a sample page that never answers.
  const hang = path === '/playground' ? '<a href="/playground?hang" id="hang">Hang the app</a>' : ''
  const actions = `<div slot="actions"><button type="button" aria-label="Help" data-bn-aria-label="সাহায্য">${icon('help')}</button><button type="button" class="e-search-button" aria-label="Search" data-bn-aria-label="খুঁজুন">${icon('search')}</button><button type="button" aria-label="Notifications" data-bn-aria-label="বিজ্ঞপ্তি">${icon('bell')}</button><button type="button" class="e-initials" popovertarget="e-user" aria-label="Rafiq Ahmed">RA</button><div id="e-user" popover class="e-user-menu">${userItems()}</div>${hang}</div>`
  const menu = settings ? settingsMenu(settingsPages.find((page) => page.path === path)) : mainMenu(path)
  return `${store}${menu}${tabs(path)}${search}${actions}`
}
