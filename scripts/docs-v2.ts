// v2's docs pages share one frame: a skip link, the header, every component in its group (a sidebar
// from 1024 px, a Pages list that opens without a script below it) and, on a component page, links
// to the pages before and after it. A page's source holds its <title> and <main>; this adds the kit,
// the docs sheet and the frame. The pages are static and read the same with JavaScript off.
import { apiSection, v2DocsManifest } from './docs-api.ts'
import { copyButtons, renderExamples } from './docs-examples.ts'

export interface V2Page {
  path: string
  title: string
  // The tags the page documents, which its API section lists.
  tags: string[]
}

const component = (slug: string, title: string, tags = [`e-${slug}`]): V2Page => ({
  path: `/components/${slug}`,
  title,
  tags,
})

// The spec's groups (spec-v2-components, the 2.0.0 set), with each new pattern in the group it belongs to.
export const v2Groups: { name: string; pages: V2Page[] }[] = [
  {
    name: 'Actions',
    pages: [
      component('button', 'Button'),
      component('button-group', 'Button group'),
      component('link', 'Link'),
      component('menu', 'Menu', ['e-menu', 'e-menu-item']),
    ],
  },
  {
    name: 'Layout',
    pages: [
      component('page', 'Page'),
      component('card', 'Card'),
      component('stack', 'Stack'),
      component('grid', 'Grid'),
      component('divider', 'Divider'),
      component('bottom-bar', 'Bottom bar'),
      component('settings-section', 'Settings section'),
    ],
  },
  {
    name: 'Text and status',
    pages: [
      component('heading', 'Heading'),
      component('text', 'Text'),
      component('badge', 'Badge'),
      component('banner', 'Banner'),
      component('empty-state', 'Empty state'),
    ],
  },
  {
    name: 'Forms',
    pages: [
      component('text-field', 'Text field'),
      component('text-area', 'Text area'),
      component('select', 'Select'),
      component('checkbox', 'Checkbox'),
      component('choice-list', 'Choice list'),
      component('switch', 'Switch'),
      component('search-field', 'Search field'),
      component('date-field', 'Date field'),
    ],
  },
  {
    name: 'Data',
    pages: [
      component('list', 'List'),
      component('table', 'Table', ['e-table', 'e-row']),
      component('index-table', 'Index table'),
      component('metrics', 'Metrics'),
      component('todo', 'To-do'),
      component('summary', 'Summary', ['e-summary', 'e-summary-row', 'e-due']),
      component('timeline', 'Timeline', ['e-timeline', 'e-timeline-day', 'e-timeline-item']),
      component('line-item', 'Line item'),
      component('person', 'Person'),
      component('contact', 'Contact'),
      component('meter', 'Meter'),
      component('chips', 'Chips', ['e-chips', 'e-chip']),
      component('tabs', 'Tabs', ['e-tabs', 'e-tab']),
      component('pagination', 'Pagination'),
      component('thumbnail', 'Thumbnail'),
      component('avatar', 'Avatar'),
    ],
  },
  {
    name: 'Overlays and feedback',
    pages: [
      component('popover', 'Popover'),
      component('tooltip', 'Tooltip'),
      component('modal', 'Modal'),
      component('spinner', 'Spinner'),
      component('skeleton', 'Skeleton'),
      component('progress-bar', 'Progress bar'),
      component('setup-guide', 'Setup guide', ['e-setup-guide', 'e-setup-step']),
    ],
  },
  {
    name: 'Helpers',
    pages: [component('icon', 'Icon'), component('kbd', 'Kbd')],
  },
  {
    name: 'Bangladesh',
    pages: [
      component('phone-field', 'Phone field'),
      component('taka-field', 'Taka field'),
      component('district-picker', 'District picker'),
      component('courier-status', 'Courier status'),
    ],
  },
]

export const v2Pages: V2Page[] = v2Groups.flatMap((group) => group.pages)

// A reader who chose Bangla gets it before the first paint, so nothing changes language once drawn.
const language = `<script>
      try {
        if (localStorage.getItem('ebdfy-docs-v2-lang') === 'bn') document.documentElement.lang = 'bn'
      } catch {}
    </script>`

// The kit first, so every e-* tag is drawn in the first frame, then the docs' own sheet and script.
const head = `${language}
    <link rel="preload" href="%EB_CDN%/ui/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="%EB_CDN%/ui/v2.css" />
    <link rel="stylesheet" href="/docs.css" />
    <script type="module" src="%EB_CDN%/ui/v2.js"></script>
    <script type="module" src="/docs.js"></script>
  </head>`

const searchIcon =
  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'

// The search and the language switch need the script, so they wait hidden until it runs.
function header(): string {
  return `<a class="skip" href="#content">Skip to content</a>
    <header class="bar">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">e</span>ebdfy<span class="long"> design system</span></a>
      <span class="version">v2</span>
      <div class="tools" hidden>
        <button type="button" class="search" aria-label="Search" aria-haspopup="dialog">${searchIcon}<span>Search</span><e-kbd shortcut="mod+k"></e-kbd></button>
        <e-button-group label="Language">
          <e-button value="bn" lang="bn">বাংলা</e-button>
          <e-button value="en" lang="en" pressed>English</e-button>
        </e-button-group>
      </div>
    </header>`
}

// The search over the pages' titles.
function finder(): string {
  const options = [{ path: '/', title: 'Overview' }, ...v2Pages].map(
    (page) => `<li role="option" aria-selected="false"><a href="${page.path}">${page.title}</a></li>`,
  )
  return `<dialog class="finder" id="finder" aria-label="Search">
      <input type="text" role="combobox" aria-label="Search pages" placeholder="Search pages" aria-expanded="true" aria-controls="finder-options" aria-autocomplete="list" autocomplete="off" />
      <ul id="finder-options" role="listbox" aria-label="Pages">${options.join('')}</ul>
      <p class="none" hidden>No page matches</p>
    </dialog>`
}

// Every page in its group, the current one marked. Each list names its groups with its own ids.
function pageLinks(current: string, prefix: string): string {
  const overview = `<a href="/"${current === '/' ? ' aria-current="page"' : ''}>Overview</a>`
  const groups = v2Groups.map((group, i) => {
    const links = group.pages.map(
      (page) =>
        `<li><a href="${page.path}"${page.path === current ? ' aria-current="page"' : ''}>${page.title}</a></li>`,
    )
    return `<p class="group" id="${prefix}-${i}">${group.name}</p><ul aria-labelledby="${prefix}-${i}">${links.join('')}</ul>`
  })
  return `<nav class="pages" aria-label="Components">${overview}${groups.join('')}</nav>`
}

function pagerLink(page: V2Page | undefined, rel: 'prev' | 'next', word: string): string {
  return page ? `<a rel="${rel}" href="${page.path}"><span>${word}</span> ${page.title}</a>` : ''
}

function pager(current: string): string {
  const at = v2Pages.findIndex((page) => page.path === current)
  if (at < 0) return ''
  return `<nav class="pager" aria-label="Previous and next">${pagerLink(v2Pages[at - 1], 'prev', 'Previous')}${pagerLink(v2Pages[at + 1], 'next', 'Next')}</nav>`
}

// The overview's list of every group, in place of its <docs-index></docs-index>.
function index(): string {
  return v2Groups
    .map(
      (group) =>
        `<section><h2>${group.name}</h2><ul>${group.pages.map((page) => `<li><a href="${page.path}">${page.title}</a></li>`).join('')}</ul></section>`,
    )
    .join('')
}

export function frameV2Page(html: string, path: string): string {
  const tags = v2Pages.find((page) => page.path === path)?.tags ?? []
  const api = tags.length ? apiSection(tags, v2DocsManifest()) : ''
  // Copy needs the script, so each button waits hidden until docs.js shows it.
  return copyButtons(renderExamples(html.replace('<docs-index></docs-index>', index())))
    .replaceAll('<button type="button" class="copy">', '<button type="button" class="copy" hidden>')
    .replace(/\s*<\/head>/, `\n    ${head}`)
    .replace(
      /<body>\s*/,
      `<body>
    ${header()}
    ${finder()}
    <details class="menu"><summary>Pages</summary>${pageLinks(path, 'menu-group')}</details>
    <div class="layout">
      <div class="sidebar">${pageLinks(path, 'group')}</div>
      `,
    )
    .replace('<main>', '<main id="content" tabindex="-1">')
    .replace('</main>', `${api}${pager(path)}</main>\n    </div>`)
}
