// The playground's Reports page keeps the staff member's cards in their order, as the Admin keeps one
// layout per staff member: Done posts the card ids, the dev server keeps them in a cookie, and every
// load of the page, whole or as the panel a move swaps in, draws those cards in that order. The
// page's file holds every card the playground can draw, the ones not on the page by default in a
// template, which this takes out; the library lists every card the page does not show.
import type { IncomingMessage, ServerResponse } from 'node:http'

import { reportsPath } from '../src/playground-admin.ts'
import { reportResult } from '../src/playground-reports.ts'
import { withAttribute } from './store-fake.ts'

const cookieName = 'ebdfy-reports-cards'

interface Card {
  id: string
  markup: string
  heading: string
  headingBn: string
}

const cardPattern = /^[ \t]*<e-card\b[^>]*\scard="([\w-]+)"[\s\S]*?<\/e-card>\n?/gm
const attributeOf = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? ''

function cardsIn(html: string): Card[] {
  return [...html.matchAll(cardPattern)].map(([markup, id = '']) => {
    const tag = /^[^>]*>/.exec(markup.trim())?.[0] ?? ''
    return { id, markup, heading: attributeOf(tag, 'heading'), headingBn: attributeOf(tag, 'data-bn-heading') }
  })
}

// The page with its cards in the order ids names, the ones it does not name left out and listed in
// the library. With no ids, the page's default order.
export function arrange(html: string, ids: string[] | null): string {
  const arranged = /(<e-arranged-cards\b[^>]*>)([\s\S]*?)(\s*<\/e-arranged-cards>)/.exec(html)
  const more = /\s*<template id="report-cards-more">([\s\S]*?)<\/template>/.exec(html)
  if (!arranged || !more) return html
  const [, open = '', inner = '', close = ''] = arranged
  const all = [...cardsIn(inner), ...cardsIn(more[1] ?? '')]
  const known = new Map(all.map((card) => [card.id, card]))
  // A card named twice is drawn once, where it first comes.
  const order = [...new Set(ids ?? attributeOf(open, 'default').split(' '))].filter((id) => known.has(id))
  const shown = order.flatMap((id) => known.get(id) ?? [])
  const library = all
    .filter((card) => !order.includes(card.id))
    .map((card) => `<button type="button" card="${card.id}" data-bn="${card.headingBn}">${card.heading}</button>`)
  return html
    .replace(more[0], () => '')
    .replace(arranged[0], () => `${open}\n${shown.map((card) => card.markup).join('')}${close.trimStart()}`)
    .replace(
      /(<div class="card-library">)[\s\S]*?(<\/div>)/,
      (_, start: string, end: string) => start + library.join('') + end,
    )
}

const idsOf = (cookie: string | undefined): string[] | null => {
  const value = cookie
    ?.split(';')
    .map((pair) => pair.trim().split('='))
    .find(([name]) => name === cookieName)?.[1]
  return value === undefined ? null : value.split('.').filter(Boolean)
}

// Answers the Reports page: a POST keeps its cards and sends the browser back to the page, and a GET
// draws the page, whole or, asked with the panel header, its panel alone, in the kept order. page
// gives the page's HTML as the dev server serves it, and panelOf cuts a page down to its panel.
export function reportsFake(page: () => Promise<string>, panelOf: (html: string) => string, panelHeader: string) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    if (req.url?.split('?')[0] !== reportsPath) return next()
    if (req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        const posted = new URLSearchParams(Buffer.concat(chunks).toString())
        const ids = (posted.get('cards') ?? '').split(/\s+/).filter((id) => /^[\w-]+$/.test(id))
        res.writeHead(303, {
          location: reportsPath,
          'set-cookie': `${cookieName}=${ids.join('.')}; Path=/; SameSite=Lax`,
        })
        res.end()
      })
      return
    }
    if (req.method !== 'GET') return next()
    const answer = async () => {
      try {
        const drawn = arrange(await page(), idsOf(req.headers.cookie))
        res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store', vary: panelHeader })
        res.end(req.headers[panelHeader.toLowerCase()] ? panelOf(drawn) : drawn)
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    }
    void answer()
  }
}

// A report the playground keeps: report 7, as the Admin would draw it, built on the new report's page.
export const newReportPath = `${reportsPath}/new`
export const savedReportPath = `${reportsPath}/7`
export const savedReport = new URLSearchParams(
  'name=Facebook by district&metric=NET_SALES&groupBy=DISTRICT&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS&view=TABLE',
)

interface Answer {
  status: 200 | 422
  html: string
}

const nameError = ['Enter a name for the report.', 'রিপোর্টের একটি নাম লিখুন।'] as const
const nameLong = ['Enter a name of at most 60 letters.', '৬০ অক্ষরের মধ্যে একটি নাম লিখুন।'] as const
const rangeLong = ['Pick at most 366 days', 'সর্বোচ্চ ৩৬৬ দিন বাছুন'] as const
const rangeOrder = ['Pick a day on or after From', 'শুরুর দিন বা তার পরের দিন বাছুন'] as const
const rangeMissing = ['Pick a From and a To day', 'শুরু ও শেষের দিন বাছুন'] as const

// Why a custom range is refused, in the builder's words where it has them.
function rangeRefusal(choices: URLSearchParams): readonly [string, string] {
  const [from, to] = [Date.parse(choices.get('from') ?? ''), Date.parse(choices.get('to') ?? '')]
  if (Number.isNaN(from) || Number.isNaN(to)) return rangeMissing
  return to < from ? rangeOrder : rangeLong
}

// The page as it was, with an error under the one field.
const refuse = (html: string, field: RegExp, [english, bangla]: readonly [string, string]): Answer => ({
  status: 422,
  html: html.replace(field, (tag) => withAttribute(withAttribute(tag, 'error', english), 'data-bn-error', bangla)),
})
const nameField = /<e-text-field\b[^>]*\sname="name"[^>]*>/

const escapeText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

// The new report's page drawn for a saved report's choices, as the Admin draws a report it keeps:
// each control shows what was saved and the result is worked out for it. An empty name is refused
// with the name's error, and the page stays a new one.
export function reportPage(html: string, choices: URLSearchParams, toast = false): Answer {
  const name = (choices.get('name') ?? '').trim()
  if (!name) return refuse(html, nameField, nameError)
  // The name field takes 60 letters, so a longer name is refused as the Admin will.
  if ([...name].length > 60) return refuse(html, nameField, nameLong)
  const result = reportResult(choices)
  // A custom range the builder refuses is refused here too, under To.
  if (!result) return refuse(html, /<e-date-field\b[^>]*\sname="to"[^>]*>/, rangeRefusal(choices))
  let page = html
    .replace(/<title>[^<·]*·/, () => `<title>${escapeText(name)} ·`)
    .replace(/<h1 data-bn="[^"]*">[^<]*<\/h1>/, () => `<h1>${escapeText(name)}</h1>`)
    .replace(/<form\b[^>]*>/, (tag) =>
      withAttribute(
        withAttribute(
          withAttribute(withAttribute(tag, 'data-save-new', false), 'action', savedReportPath),
          'data-save-message',
          'Unsaved report',
        ),
        'data-bn-data-save-message',
        'অসংরক্ষিত রিপোর্ট',
      ),
    )
    .replace(/<e-text-field\b[^>]*\sname="name"[^>]*>/, (tag) => withAttribute(tag, 'value', name))
    .replaceAll(/<e-date-field\b[^>]*\sname="(from|to)"[^>]*>/g, (tag, field: string) =>
      withAttribute(tag, 'value', choices.get(field) ?? false),
    )
    .replaceAll(/<e-select\b[^>]*\sname="([^"]*)"[\s\S]*?<\/e-select>/g, (select, field: string) =>
      select.replaceAll(/<option\b[^>]*>/g, (option) =>
        withAttribute(option, 'selected', /\svalue="([^"]*)"/.exec(option)?.[1] === choices.get(field)),
      ),
    )
    .replaceAll(/<input type="checkbox" name="([^"]*)" value="([^"]*)"[^>]*>/g, (tag, field: string, value: string) =>
      withAttribute(tag, 'checked', choices.getAll(field).includes(value.replaceAll('&quot;', '"'))),
    )
    .replace(/<input type="hidden" name="view"[^>]*>/, (tag) =>
      withAttribute(tag, 'value', choices.get('view') ?? 'TABLE'),
    )
    .replaceAll(/<e-button type="button" value="(CHART|TABLE)"[^>]*>/g, (tag, view: string) =>
      withAttribute(tag, 'pressed', view === (choices.get('view') ?? 'TABLE')),
    )
  page = page.replace(/<e-report-result\b[\s\S]*?<\/e-report-result\s*>/, () => result)
  if (toast) {
    page = page.replace(/<e-admin-panel\b[^>]*>/, (tag) =>
      withAttribute(withAttribute(tag, 'toast', 'Report saved'), 'data-bn-toast', 'রিপোর্ট সংরক্ষিত হয়েছে'),
    )
  }
  return { status: 200, html: page }
}

// Answers report 7, whole or as its panel, and a save of the new report or of report 7, as the
// Admin's Worker will. Nothing is kept between saves, so a reload shows report 7 as it was.
export function reportFake(page: () => Promise<string>, panelOf: (html: string) => string, panelHeader: string) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const path = req.url?.split('?')[0]
    const saving = req.method === 'POST' && (path === newReportPath || path === savedReportPath)
    if (!saving && !(req.method === 'GET' && path === savedReportPath)) return next()
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        let choices = savedReport
        if (saving) {
          // A form posts urlencoded or multipart fields; any other body is no save.
          if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)\b/.test(req.headers['content-type'] ?? '')) {
            res.writeHead(415, { 'content-type': 'text/plain' })
            res.end('Send the form')
            return
          }
          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
          }
          const posted = await new Request(`http://${req.headers.host}${req.url}`, {
            method: 'POST',
            headers,
            body: Buffer.concat(chunks),
          }).formData()
          // The form has no file input, so every posted value is text.
          choices = new URLSearchParams([...posted].map(([name, value]) => [name, String(value)]))
        }
        const answer = reportPage(await page(), choices, saving)
        const panel = req.headers[panelHeader.toLowerCase()] !== undefined
        res.writeHead(answer.status, { 'content-type': 'text/html', 'cache-control': 'no-store', vary: panelHeader })
        res.end(panel ? panelOf(answer.html) : answer.html)
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
