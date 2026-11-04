// The docs pages share one frame: a skip link, the header, a sidebar of every page in its group and,
// on a component page, links to the pages before and after it. Each page's source holds only its
// <main>; this puts the frame around it, in development and in the build.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { apiSection } from './docs-api.ts'
import { copyButtons, firstExample, renderExamples } from './docs-examples.ts'

export interface DocsPage {
  path: string
  title: string
  // The elements the page documents, which its API section lists.
  tags: string[]
}

export const groups: { name: string; pages: DocsPage[] }[] = [
  {
    name: 'Foundations',
    pages: [
      { path: '/foundations', title: 'Foundations', tags: [] },
      { path: '/components/heading', title: 'Heading', tags: ['eb-heading'] },
      { path: '/components/text', title: 'Text', tags: ['eb-text'] },
      { path: '/components/icon', title: 'Icon', tags: ['eb-icon'] },
      { path: '/components/kbd', title: 'Kbd', tags: ['eb-kbd'] },
    ],
  },
  {
    name: 'Actions',
    pages: [
      { path: '/components/button', title: 'Button', tags: ['eb-button'] },
      { path: '/components/button-group', title: 'Button group', tags: ['eb-button-group'] },
      { path: '/components/link', title: 'Link', tags: ['eb-link'] },
    ],
  },
  {
    name: 'Forms',
    pages: [
      { path: '/components/text-field', title: 'Text field', tags: ['eb-text-field'] },
      { path: '/components/text-area', title: 'Text area', tags: ['eb-text-area'] },
      { path: '/components/select', title: 'Select', tags: ['eb-select'] },
      { path: '/components/search-field', title: 'Search field', tags: ['eb-search-field'] },
      { path: '/components/date-field', title: 'Date field', tags: ['eb-date-field'] },
      { path: '/components/phone-field', title: 'Phone field', tags: ['eb-phone-field'] },
      { path: '/components/taka-field', title: 'Taka field', tags: ['eb-taka-field'] },
      { path: '/components/district-picker', title: 'District picker', tags: ['eb-district-picker'] },
      { path: '/components/checkbox', title: 'Checkbox', tags: ['eb-checkbox'] },
      { path: '/components/choice-list', title: 'Choice list', tags: ['eb-choice-list'] },
      { path: '/components/switch', title: 'Switch', tags: ['eb-switch'] },
    ],
  },
  {
    name: 'Data',
    pages: [
      { path: '/components/table', title: 'Table', tags: ['eb-table', 'eb-row'] },
      { path: '/components/list', title: 'List', tags: ['eb-list'] },
      { path: '/components/tabs', title: 'Tabs', tags: ['eb-tabs', 'eb-tab'] },
      { path: '/components/pagination', title: 'Pagination', tags: ['eb-pagination'] },
      { path: '/components/bulk-bar', title: 'Bulk bar', tags: ['eb-bulk-bar'] },
      { path: '/components/badge', title: 'Badge', tags: ['eb-badge'] },
      { path: '/components/avatar', title: 'Avatar', tags: ['eb-avatar'] },
      { path: '/components/thumbnail', title: 'Thumbnail', tags: ['eb-thumbnail'] },
      { path: '/components/courier-status', title: 'Courier status', tags: ['eb-courier-status'] },
    ],
  },
  {
    name: 'Feedback',
    pages: [
      { path: '/components/banner', title: 'Banner', tags: ['eb-banner'] },
      { path: '/components/empty-state', title: 'Empty state', tags: ['eb-empty-state'] },
      { path: '/components/skeleton', title: 'Skeleton', tags: ['eb-skeleton'] },
      { path: '/components/spinner', title: 'Spinner', tags: ['eb-spinner'] },
      { path: '/components/progress-bar', title: 'Progress bar', tags: ['eb-progress-bar'] },
    ],
  },
  {
    name: 'Overlays',
    pages: [
      { path: '/components/menu', title: 'Menu', tags: ['eb-menu', 'eb-menu-item'] },
      { path: '/components/popover', title: 'Popover', tags: ['eb-popover'] },
      { path: '/components/tooltip', title: 'Tooltip', tags: ['eb-tooltip'] },
    ],
  },
  {
    name: 'Layout',
    pages: [
      { path: '/components/page', title: 'Page', tags: ['eb-page'] },
      { path: '/components/card', title: 'Card', tags: ['eb-card'] },
      { path: '/components/stack', title: 'Stack', tags: ['eb-stack'] },
      { path: '/components/grid', title: 'Grid', tags: ['eb-grid'] },
      { path: '/components/divider', title: 'Divider', tags: ['eb-divider'] },
      { path: '/components/bottom-bar', title: 'Bottom bar', tags: ['eb-bottom-bar'] },
    ],
  },
  {
    name: 'Admin chrome',
    pages: [
      { path: '/components/chrome', title: 'Admin chrome', tags: ['eb-admin-chrome'] },
      { path: '/components/modal', title: 'Modal', tags: [] },
      { path: '/components/toast', title: 'Toast', tags: [] },
      { path: '/playground', title: 'Playground', tags: [] },
    ],
  },
]

export const docsPages: DocsPage[] = groups.flatMap((group) => group.pages)

// The page a site/ui file serves: components/button.html is /components/button, index.html is /.
export function pathOf(file: string): string {
  return `/${file.replace(/(index)?\.html$/, '')}`
}

const icon = (paths: string) =>
  `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${paths}</svg>`

// SAFETY: @ebdfy/ui's package.json always has a version.
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

// The version these docs describe: the package's own.
export const docsVersion = packageJson.version

// A page with examples gets the language switch; the examples carry their words in both languages.
function header(withLanguage: boolean): string {
  const language = withLanguage
    ? `
        <eb-button-group segmented id="language" label="Language">
          <eb-button data-lang="bn" pressed="false">বাংলা</eb-button>
          <eb-button data-lang="en" pressed="true">English</eb-button>
        </eb-button-group>`
    : ''
  return `<a class="skip" href="#content">Skip to content</a>
    <header class="bar">
      <button type="button" class="menu" aria-expanded="false" aria-controls="drawer">${icon('<path d="M4 6h16M4 12h16M4 18h16"/>')}Pages</button>
      <a class="brand" href="/"><span class="mark" aria-hidden="true">eb</span>ebdfy design system</a>
      <span class="version">v${docsVersion}</span>
      <nav class="links" aria-label="Project">
        <a href="https://www.npmjs.com/package/@ebdfy/ui">npm</a>
        <a href="https://github.com/ebdfy/ui">GitHub</a>
      </nav>
      <button type="button" class="search" aria-label="Search" aria-haspopup="dialog">${icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}<span>Search</span><eb-kbd shortcut="mod+k"></eb-kbd></button>
      <div class="switches">${language}
        <eb-button-group segmented class="theme-switch" label="Theme">
          <eb-button data-theme-choice="system" pressed="true">System</eb-button>
          <eb-button data-theme-choice="light" pressed="false">Light</eb-button>
          <eb-button data-theme-choice="dark" pressed="false">Dark</eb-button>
        </eb-button-group>
      </div>
    </header>`
}

// Every page in its group, the current one marked. The sidebar shows it from 1024 px; below that the
// drawer behind the Pages button does, so each list names its groups with its own ids.
function pageLinks(current: string, prefix: string): string {
  return groups
    .map((group, i) => {
      const links = group.pages.map(
        (page) =>
          `<li><a href="${page.path}"${page.path === current ? ' aria-current="page"' : ''}>${page.title}</a></li>`,
      )
      return `<p class="group" id="${prefix}-${i}">${group.name}</p><ul aria-labelledby="${prefix}-${i}">${links.join('')}</ul>`
    })
    .join('')
}

function sidebar(current: string): string {
  return `<nav class="sidebar pages" aria-label="Pages">${pageLinks(current, 'group')}</nav>`
}

// The drawer of every page for a phone, and the search over the pages' titles.
function dialogs(current: string): string {
  const options = docsPages.map((page) => `<li role="option"><a href="${page.path}">${page.title}</a></li>`)
  return `<dialog class="drawer" id="drawer" aria-label="Pages">
      <button type="button" class="close">${icon('<path d="M18 6 6 18M6 6l12 12"/>')}Close</button>
      <nav class="pages" aria-label="Pages">${pageLinks(current, 'drawer-group')}</nav>
    </dialog>
    <dialog class="finder" id="finder" aria-label="Search">
      <input type="text" role="combobox" aria-label="Search pages" placeholder="Search pages" aria-expanded="true" aria-controls="finder-options" aria-autocomplete="list" autocomplete="off" />
      <ul id="finder-options" role="listbox" aria-label="Pages">${options.join('')}</ul>
      <p class="none" hidden>No page matches</p>
    </dialog>`
}

function pagerLink(page: DocsPage | undefined, rel: 'prev' | 'next', word: string): string {
  return page ? `<a rel="${rel}" href="${page.path}"><span>${word}</span> ${page.title}</a>` : ''
}

function pager(current: string): string {
  const pages = docsPages.filter((page) => page.path.startsWith('/components/'))
  const at = pages.findIndex((page) => page.path === current)
  if (at < 0) return ''
  return `<nav class="pager" aria-label="Previous and next">${pagerLink(pages[at - 1], 'prev', 'Previous')}${pagerLink(pages[at + 1], 'next', 'Next')}</nav>`
}

const uiDir = fileURLToPath(new URL('../site/ui/', import.meta.url))

// Each tile on the home page shows a live preview: the first example of the page it links to, or
// its own markup where that example needs a page of its own. The preview is for the eye only.
function fillPreviews(html: string): string {
  return html.replace(
    /<div class="preview"(?: data-from="([^"]+)")?>([\s\S]*?)<\/div>/g,
    (_, from: string | undefined, own: string) =>
      `<div class="preview" inert>${from ? firstExample(readFileSync(`${uiDir}${from.slice(1)}.html`, 'utf8')) : own}</div>`,
  )
}

// Puts the frame around a docs page's <main>. The playground keeps its own frame.
export function framePage(html: string, path: string): string {
  if (path === '/playground') return html
  const tags = docsPages.find((page) => page.path === path)?.tags ?? []
  return copyButtons(renderExamples(path === '/' ? fillPreviews(html) : html))
    .replace(
      /<body>\s*/,
      `<body>\n    ${header(html.includes('id="examples"'))}\n    ${dialogs(path)}\n    <div class="layout">\n      ${sidebar(path)}\n    `,
    )
    .replace('<main>', '<main id="content" tabindex="-1">')
    .replace('</main>', `${apiSection(tags)}${pager(path)}</main>\n    </div>`)
}
