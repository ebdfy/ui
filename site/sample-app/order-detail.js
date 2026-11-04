import { orderStatus } from './orders.js'

// An order from the list (orders.js) as the order page shows it on a phone and the orders page
// beside its list on a computer: the amount first, the return-risk banner, the customer, then the
// items.

// The bKash advance a merchant asks of a cash-on-delivery customer.
const advance = 120
// Inside Dhaka a parcel costs 60 to deliver, outside it 120.
const insideDhaka = 60

// A Bangla name takes র after a vowel sign and ের after a consonant to say "of".
const of = (name) => name + (/[া-ৌ]$/.test(name) ? 'র' : 'ের')

const words = {
  bn: {
    title: (order) => `অর্ডার #${order.number}`,
    COD: 'ক্যাশ অন ডেলিভারি',
    bkash: 'বিকাশ',
    when: '২ ঘণ্টা আগে · মেসেঞ্জার',
    risk: (d, t, { returned, orders }) =>
      `এই নম্বরের ${d(orders)}টি অর্ডারের ${d(returned)}টি ফেরত এসেছে। বিকাশে ${t(advance)} অগ্রিম নিন।`,
    history: (d, { returned, orders }) => `${d(orders)} অর্ডার · ${d(orders - returned)} ডেলিভারড · ${d(returned)} ফেরত`,
    items: 'পণ্য',
    delivery: (charge) => (charge === insideDhaka ? 'ডেলিভারি, ঢাকার ভেতরে' : 'ডেলিভারি, ঢাকার বাইরে'),
    ask: 'অগ্রিম চাই',
    confirm: 'কনফার্ম করুন',
    asked: (t, name) => `${of(name)} কাছে বিকাশে ${t(advance)} অগ্রিম চাওয়া হয়েছে`,
    confirmed: (order) => `অর্ডার #${order.number} কনফার্ম হয়েছে`,
  },
  en: {
    title: (order) => `Order #${order.number}`,
    COD: 'Cash on delivery',
    bkash: 'bKash',
    when: '2 h ago · Messenger',
    risk: (d, t, { returned, orders }) =>
      `${d(returned)} of this phone’s ${d(orders)} orders came back. Ask for a ${t(advance)} bKash advance.`,
    history: (d, { returned, orders }) =>
      `${d(orders)} orders · ${d(orders - returned)} delivered · ${d(returned)} returned`,
    items: 'Items',
    delivery: (charge) => (charge === insideDhaka ? 'Delivery, inside Dhaka' : 'Delivery, outside Dhaka'),
    ask: 'Ask for advance',
    confirm: 'Confirm order',
    asked: (t, name) => `Asked ${name} for a ${t(advance)} bKash advance`,
    confirmed: (order) => `Order #${order.number} confirmed`,
  },
}

export const orderTitle = (lang, order) => words[lang].title(order)

function element(name, attributes = {}, ...children) {
  const el = document.createElement(name)
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value)
  el.append(...children)
  return el
}

const text = (words, attributes = {}) => element('eb-text', attributes, words)
const meta = (words) => text(words, { variant: 'meta' })
// A row of parts, the one marked grow taking the room left.
const row = (...children) => element('div', { class: 'order-row' }, ...children)
const column = (...children) => element('div', { class: 'order-column' }, ...children)

// Fills container with the order in lang. pane adds the order number as the heading above the
// amount, which on a phone the title bar carries instead. Only an order whose customer's orders keep
// coming back shows the risk banner and their history.
export function showOrder(container, lang, order, { pane = false } = {}) {
  const t = words[lang]
  const { digits, taka } = globalThis.ebdfy.format
  const d = (n) => digits(n, lang)
  const money = (n) => taka(n, lang)
  const phone = `${order.phone.slice(0, 5)}-${order.phone.slice(5)}`
  const customer = order.customer[lang]
  const paid = order.payment.method === 'COD' ? t.COD : `${t.bkash} ${money(order.payment.paid)}`

  const parts = []
  if (pane) parts.push(element('eb-heading', { level: '1' }, `#${order.number}`))
  parts.push(
    column(
      element('eb-heading', { level: '2' }, money(order.total)),
      row(orderStatus(order, lang), meta(`${paid} · ${t.when}`)),
    ),
  )
  if (order.returns) parts.push(element('eb-banner', { tone: 'danger' }, t.risk(d, money, order.returns)))
  parts.push(
    element(
      'eb-card',
      {},
      column(
        row(element('eb-avatar', { name: customer }), column(text(customer), meta(phone))),
        ...(order.returns ? [meta(t.history(d, order.returns))] : []),
        meta(`${order.street[lang]}, ${order.place[lang]}`),
      ),
    ),
    element(
      'eb-card',
      { heading: t.items },
      column(
        ...order.items.map((item) =>
          // The price stands on the item's first line, beside its name.
          element(
            'div',
            { class: 'order-row', style: 'align-items: flex-start' },
            element('eb-thumbnail', { size: 'small', alt: item.name[lang] }),
            column(
              text(item.name[lang]),
              meta([item.detail?.[lang], `${d(item.quantity)} × ${money(item.price)}`].filter(Boolean).join(' · ')),
            ),
            text(money(item.quantity * item.price)),
          ),
        ),
        element('eb-divider'),
        // The delivery's label takes the room, so its charge stands in the prices' column.
        row(column(meta(t.delivery(order.delivery))), text(money(order.delivery))),
      ),
    ),
  )
  container.replaceChildren(...parts)
}

// The actions the order still takes, in lang: before it ships, a cash-on-delivery order can ask the
// customer for an advance, and a new one can be confirmed. Each has its label and handler, for the
// Admin's title bar, and its look, for a bar of buttons.
export function orderActionList(lang, order, onConfirm) {
  const t = words[lang]
  const { taka } = globalThis.ebdfy.format
  const actions = []
  if (order.courier) return actions
  if (order.payment.method === 'COD') {
    actions.push({
      label: t.ask,
      variant: 'secondary',
      onAction: () => globalThis.ebdfy.toast(t.asked((n) => taka(n, lang), order.customer[lang])),
    })
  }
  if (order.status === 'NEW') {
    actions.push({
      label: t.confirm,
      variant: 'primary',
      onAction: () => {
        globalThis.ebdfy.toast(t.confirmed(order))
        onConfirm?.()
      },
    })
  }
  return actions
}

// The same two actions as buttons.
export function orderActions(lang, order, onConfirm) {
  return orderActionList(lang, order, onConfirm).map(({ label, variant, onAction }) => {
    const button = element('eb-button', { variant, 'full-width': '' }, label)
    button.addEventListener('click', onAction)
    return button
  })
}
