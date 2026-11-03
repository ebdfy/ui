// Stands in for the ebdfy API's orders query, which pages by cursor, answering after a short wait.
const orders = [
  {
    number: 1042,
    customer: 'রহিম উদ্দিন',
    place: 'মিরপুর, ঢাকা',
    total: 1250,
    status: 'NEW',
    courier: null,
    payment: { method: 'COD' },
  },
  {
    number: 1041,
    customer: 'সুমাইয়া আক্তার',
    place: 'আগ্রাবাদ, চট্টগ্রাম',
    total: 860,
    status: 'CONFIRMED',
    courier: null,
    payment: { method: 'BKASH', paid: 120 },
  },
  {
    number: 1040,
    customer: 'করিম শেখ',
    place: 'জিন্দাবাজার, সিলেট',
    total: 2450,
    status: 'CONFIRMED',
    courier: 'IN_TRANSIT',
    payment: { method: 'COD' },
  },
  // A customer whose orders keep coming back: 3 of their 5.
  {
    number: 1039,
    customer: 'মো. হাসান',
    place: 'সাভার, ঢাকা',
    total: 1800,
    status: 'NEW',
    courier: null,
    payment: { method: 'COD' },
    returns: { returned: 3, orders: 5 },
  },
  {
    number: 1038,
    customer: 'নাসরিন সুলতানা',
    place: 'খুলনা সদর, খুলনা',
    total: 640,
    status: 'CONFIRMED',
    courier: 'RETURNED',
    payment: { method: 'COD' },
  },
  {
    number: 1037,
    customer: 'তানভীর আহমেদ',
    place: 'রাজপাড়া, রাজশাহী',
    total: 990,
    status: 'CONFIRMED',
    courier: 'DELIVERED',
    payment: { method: 'COD' },
  },
]

const pageSize = 5

// The orders list's filters, in the order the toolbar shows them.
const filters = {
  all: () => true,
  new: (order) => order.status === 'NEW' && !order.courier,
  confirmed: (order) => order.status === 'CONFIRMED' && !order.courier,
  courier: (order) => order.courier === 'IN_TRANSIT',
  returned: (order) => order.courier === 'RETURNED',
}

// How many orders each filter holds, for the toolbar's counts.
export function countOrders() {
  return Object.fromEntries(Object.entries(filters).map(([name, keep]) => [name, orders.filter(keep).length]))
}

// query matches an order's number or its customer's name.
export async function listOrders({ drafts = false, page = 1, filter = 'all', query = '' } = {}) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (drafts) return { orders: [], hasPrevious: false, hasNext: false }
  const wanted = query.trim().replace(/^#/, '')
  const found = orders.filter(
    (order) =>
      filters[filter](order) && (!wanted || String(order.number).includes(wanted) || order.customer.includes(wanted)),
  )
  const start = (page - 1) * pageSize
  return {
    orders: found.slice(start, start + pageSize),
    hasPrevious: page > 1,
    hasNext: start + pageSize < found.length,
  }
}

export const statusOf = (number) => orders.find((order) => order.number === number).status

// Stands in for the API's confirm mutation.
export function confirmOrders(numbers) {
  for (const order of orders) if (numbers.includes(order.number) && order.status === 'NEW') order.status = 'CONFIRMED'
}

const words = {
  bn: {
    columns: ['অর্ডার', 'কাস্টমার', 'এলাকা', 'অবস্থা', 'পেমেন্ট', 'মোট'],
    NEW: 'নতুন',
    CONFIRMED: 'কনফার্মড',
    bkash: 'বিকাশ',
    risk: 'ফেরতের ঝুঁকি বেশি',
    returns: (returned, of) => `${of}টি অর্ডারের ${returned}টি ফেরত এসেছে`,
  },
  en: {
    columns: ['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total'],
    NEW: 'New',
    CONFIRMED: 'Confirmed',
    bkash: 'bKash',
    risk: 'High return risk',
    returns: (returned, of) => `${returned} of this customer's ${of} orders came back`,
  },
}
const tones = { NEW: 'attention', CONFIRMED: 'info' }

// Beside the pane, which shows from 1040 px, each column takes a share of about a tenth of its
// widest cell in either language plus its 24 px of padding, so every row stays one line. A table
// without the pane shares its width evenly, which keeps the order number and the total whole.
export const besidePane = matchMedia('(min-width: 1040px)')
const grows = [6.6, 11.8, 13.8, 13, 10, 7.2]

// Lucide's triangle-alert, the risk flag's icon.
const alertIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>`

function element(name, attributes = {}, ...children) {
  const el = document.createElement(name)
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value)
  el.append(...children)
  return el
}

// An icon-only flag: the tooltip gives it its name and shows the same words on hover and focus.
function riskFlag(t) {
  const icon = element('span', { role: 'img', style: 'display: inline-flex; color: var(--eb-color-danger-text)' })
  icon.innerHTML = alertIcon
  return element('eb-tooltip', { text: t.risk }, icon)
}

// The courier's word once an order ships, the order's own before.
function status(order, t) {
  if (order.courier) return element('eb-courier-status', { status: order.courier })
  return element('eb-badge', { tone: tones[order.status] }, t[order.status])
}

function payment(order, t, lang) {
  if (order.payment.method === 'COD') return 'COD'
  return `${t.bkash} ${globalThis.ebdfy.format.taka(order.payment.paid, lang)}`
}

// Fills an eb-table with its columns and a row for each order, in the page's language. The open
// order, the one shown beside the list, carries the open bar.
export function showOrders(table, orders, lang, open) {
  const t = words[lang]
  const { digits, taka } = globalThis.ebdfy.format
  const places = ['meta', 'title', 'meta', 'status', 'meta', 'end']
  const columns = t.columns.map((label, i) =>
    element('eb-column', { card: places[i], grow: besidePane.matches ? grows[i] : 1 }, label),
  )
  const rows = orders.map((order) => {
    const customer = element('span', {}, order.customer)
    if (order.returns) customer.append(' ', riskFlag(t))
    const row = element(
      'eb-row',
      { 'data-number': order.number },
      element('span', {}, `#${order.number}`),
      customer,
      element('span', {}, order.place),
      element('span', {}, status(order, t)),
      element('span', {}, payment(order, t, lang)),
      element('span', {}, taka(order.total, lang)),
    )
    if (order.returns) {
      const { returned, orders: of } = order.returns
      row.append(
        element('eb-banner', { card: 'note', tone: 'danger' }, t.returns(digits(returned, lang), digits(of, lang))),
      )
    }
    row.toggleAttribute('open', order.number === open)
    return row
  })
  table.replaceChildren(...columns, ...rows)
}
