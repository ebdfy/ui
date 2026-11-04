// Stands in for the ebdfy API's orders query, which pages by cursor, answering after a short wait.
// Each order's items and its delivery charge add up to its total.
const orders = [
  {
    number: 1042,
    phone: '01712004218',
    street: { en: 'Road 7, Section 10', bn: 'রোড ৭, সেকশন ১০' },
    items: [
      {
        name: { en: 'Three-piece', bn: 'থ্রি-পিস' },
        detail: { en: 'Blue · M', bn: 'নীল · M' },
        quantity: 1,
        price: 990,
      },
      { name: { en: 'Orna', bn: 'ওড়না' }, detail: { en: 'Blue', bn: 'নীল' }, quantity: 1, price: 200 },
    ],
    delivery: 60,
    customer: { en: 'Rahim Uddin', bn: 'রহিম উদ্দিন' },
    place: { en: 'Mirpur, Dhaka', bn: 'মিরপুর, ঢাকা' },
    total: 1250,
    status: 'NEW',
    courier: null,
    payment: { method: 'COD' },
  },
  {
    number: 1041,
    phone: '01819003127',
    street: { en: 'House 12, Lane 3', bn: 'বাসা ১২, লেন ৩' },
    items: [
      { name: { en: 'Kurti', bn: 'কুর্তি' }, detail: { en: 'Maroon · S', bn: 'মেরুন · S' }, quantity: 1, price: 740 },
    ],
    delivery: 120,
    customer: { en: 'Sumaiya Akter', bn: 'সুমাইয়া আক্তার' },
    place: { en: 'Agrabad, Chattogram', bn: 'আগ্রাবাদ, চট্টগ্রাম' },
    total: 860,
    status: 'CONFIRMED',
    courier: null,
    payment: { method: 'BKASH', paid: 120 },
  },
  {
    number: 1040,
    phone: '01611007754',
    street: { en: 'House 9, Kumarpara', bn: 'বাসা ৯, কুমারপাড়া' },
    items: [
      { name: { en: 'Panjabi', bn: 'পাঞ্জাবি' }, detail: { en: 'Navy · XL', bn: 'নেভি · XL' }, quantity: 2, price: 900 },
      { name: { en: 'Pajama', bn: 'পায়জামা' }, detail: { en: 'White · XL', bn: 'সাদা · XL' }, quantity: 1, price: 530 },
    ],
    delivery: 120,
    customer: { en: 'Karim Sheikh', bn: 'করিম শেখ' },
    place: { en: 'Zindabazar, Sylhet', bn: 'জিন্দাবাজার, সিলেট' },
    total: 2450,
    status: 'CONFIRMED',
    courier: 'IN_TRANSIT',
    payment: { method: 'COD' },
  },
  // A customer whose orders keep coming back: 3 of their 5.
  {
    number: 1039,
    phone: '01911004471',
    street: { en: 'House 4, Bank Town', bn: 'বাসা ৪, ব্যাংক টাউন' },
    items: [
      { name: { en: 'Panjabi', bn: 'পাঞ্জাবি' }, detail: { en: 'Cream · L', bn: 'ক্রিম · L' }, quantity: 2, price: 500 },
      { name: { en: 'Tupi', bn: 'টুপি' }, detail: { en: 'White', bn: 'সাদা' }, quantity: 1, price: 290 },
      { name: { en: 'Attar', bn: 'আতর' }, quantity: 1, price: 450 },
    ],
    delivery: 60,
    customer: { en: 'Md. Hasan', bn: 'মো. হাসান' },
    place: { en: 'Savar, Dhaka', bn: 'সাভার, ঢাকা' },
    total: 1800,
    status: 'NEW',
    courier: null,
    payment: { method: 'COD' },
    returns: { returned: 3, orders: 5 },
  },
  {
    number: 1038,
    phone: '01511002396',
    street: { en: 'House 21, KDA Avenue', bn: 'বাসা ২১, কেডিএ এভিনিউ' },
    items: [
      { name: { en: 'Tupi', bn: 'টুপি' }, detail: { en: 'White', bn: 'সাদা' }, quantity: 1, price: 290 },
      { name: { en: 'Attar', bn: 'আতর' }, quantity: 1, price: 230 },
    ],
    delivery: 120,
    customer: { en: 'Nasrin Sultana', bn: 'নাসরিন সুলতানা' },
    place: { en: 'Khulna Sadar, Khulna', bn: 'খুলনা সদর, খুলনা' },
    total: 640,
    status: 'CONFIRMED',
    courier: 'RETURNED',
    payment: { method: 'COD' },
  },
  {
    number: 1037,
    phone: '01310005582',
    street: { en: 'House 3, Sagarpara Road', bn: 'বাসা ৩, সাগরপাড়া রোড' },
    items: [
      { name: { en: 'Lungi', bn: 'লুঙ্গি' }, detail: { en: 'Blue check', bn: 'নীল চেক' }, quantity: 2, price: 435 },
    ],
    delivery: 120,
    customer: { en: 'Tanvir Ahmed', bn: 'তানভীর আহমেদ' },
    place: { en: 'Rajpara, Rajshahi', bn: 'রাজপাড়া, রাজশাহী' },
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

// query matches an order's number or its customer's name in either language, so a search typed in
// either script finds the order.
export async function listOrders({ drafts = false, page = 1, filter = 'all', query = '' } = {}) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (drafts) return { orders: [], hasPrevious: false, hasNext: false }
  const wanted = query.trim().replace(/^#/, '')
  const found = orders.filter(
    (order) =>
      filters[filter](order) &&
      (!wanted ||
        String(order.number).includes(wanted) ||
        order.customer.bn.includes(wanted) ||
        order.customer.en.toLowerCase().includes(wanted.toLowerCase())),
  )
  const start = (page - 1) * pageSize
  return {
    orders: found.slice(start, start + pageSize),
    hasPrevious: page > 1,
    hasNext: start + pageSize < found.length,
  }
}

export const orderOf = (number) => orders.find((order) => order.number === number)

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
// It drops 3 px from the baseline so its middle meets the middle of the name's letters.
function riskFlag(t) {
  const icon = element('span', {
    role: 'img',
    style: 'display: inline-flex; vertical-align: -3px; color: var(--eb-color-danger-text)',
  })
  icon.innerHTML = alertIcon
  return element('eb-tooltip', { text: t.risk }, icon)
}

// The courier's word once an order ships, the order's own before.
function status(order, t) {
  if (order.courier) return element('eb-courier-status', { status: order.courier })
  return element('eb-badge', { tone: tones[order.status] }, t[order.status])
}

// The order's status as the list draws it, for the order's own page and the pane.
export const orderStatus = (order, lang) => status(order, words[lang])

function payment(order, t, lang) {
  if (order.payment.method === 'COD') return 'COD'
  return `${t.bkash} ${globalThis.ebdfy.format.taka(order.payment.paid, lang)}`
}

// An order's page, keeping the store the Admin opened the app for: a new tab then opens inside the
// Admin too, and #1039's address is its nav entry's own, which the Admin marks current.
function orderPage(number) {
  const query = new URLSearchParams()
  const store = new URLSearchParams(location.search).get('store')
  if (store) query.set('store', store)
  if (number !== 1039) query.set('order', number)
  return `/order-1039${query.size ? `?${query}` : ''}`
}

// Fills an eb-table with its columns and a row for each order, in the page's language. Each row
// links to its order's page. The open order, the one shown beside the list, carries the open bar.
export function showOrders(table, orders, lang, open) {
  const t = words[lang]
  const { digits, taka } = globalThis.ebdfy.format
  const places = ['meta', 'title', 'meta', 'status', 'meta', 'end']
  // A narrow table lets Area, then Payment, step aside; the total ends on the right.
  const more = [{}, {}, { priority: 3 }, {}, { priority: 2 }, { align: 'end' }]
  const columns = t.columns.map((label, i) =>
    element('eb-column', { card: places[i], grow: besidePane.matches ? grows[i] : 1, ...more[i] }, label),
  )
  const rows = orders.map((order) => {
    const customer = element('span', {}, order.customer[lang])
    if (order.returns) customer.append(' ', riskFlag(t))
    const row = element(
      'eb-row',
      { 'data-number': order.number, href: orderPage(order.number) },
      element('span', {}, `#${order.number}`),
      customer,
      element('span', {}, order.place[lang]),
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
