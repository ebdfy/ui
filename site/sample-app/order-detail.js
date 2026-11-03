// Order #1039 as the order page shows it on a phone and the orders page beside its list on a
// computer: the amount first, the return-risk banner, the customer, then the items.
const order = {
  number: 1039,
  total: 1800,
  advance: 120,
  phone: '01911004471',
  history: { orders: 5, delivered: 2, returned: 3 },
  items: [
    { name: { en: 'Panjabi', bn: 'পাঞ্জাবি' }, detail: { en: 'Cream · L', bn: 'ক্রিম · L' }, quantity: 2, price: 500 },
    { name: { en: 'Tupi', bn: 'টুপি' }, detail: { en: 'White', bn: 'সাদা' }, quantity: 1, price: 290 },
    { name: { en: 'Attar', bn: 'আতর' }, quantity: 1, price: 450 },
  ],
  delivery: 60,
}

const words = {
  bn: {
    title: `অর্ডার #${order.number}`,
    NEW: 'নতুন',
    CONFIRMED: 'কনফার্মড',
    meta: 'ক্যাশ অন ডেলিভারি · ২ ঘণ্টা আগে · মেসেঞ্জার',
    when: '২ ঘণ্টা আগে · মেসেঞ্জার থেকে',
    risk: (d, t) =>
      `এই নম্বরের ${d(order.history.orders)}টি অর্ডারের ${d(order.history.returned)}টি ফেরত এসেছে। বিকাশে ${t(order.advance)} অগ্রিম নিন।`,
    customer: 'মো. হাসান',
    history: (d) =>
      `${d(order.history.orders)} অর্ডার · ${d(order.history.delivered)} ডেলিভারড · ${d(order.history.returned)} ফেরত`,
    address: 'বাসা ৪, ব্যাংক টাউন, সাভার, ঢাকা',
    items: 'পণ্য',
    delivery: 'ডেলিভারি, ঢাকার ভেতরে',
    ask: 'অগ্রিম চাই',
    confirm: 'কনফার্ম করুন',
    asked: (t) => `মো. হাসানের কাছে বিকাশে ${t(order.advance)} অগ্রিম চাওয়া হয়েছে`,
    confirmed: `অর্ডার #${order.number} কনফার্ম হয়েছে`,
  },
  en: {
    title: `Order #${order.number}`,
    NEW: 'New',
    CONFIRMED: 'Confirmed',
    meta: 'Cash on delivery · 2 h ago · Messenger',
    when: '2 h ago · from Messenger',
    risk: (d, t) =>
      `${d(order.history.returned)} of this phone’s ${d(order.history.orders)} orders came back. Ask for a ${t(order.advance)} bKash advance.`,
    customer: 'Md. Hasan',
    history: (d) =>
      `${d(order.history.orders)} orders · ${d(order.history.delivered)} delivered · ${d(order.history.returned)} returned`,
    address: 'House 4, Bank Town, Savar, Dhaka',
    items: 'Items',
    delivery: 'Delivery, inside Dhaka',
    ask: 'Ask for advance',
    confirm: 'Confirm order',
    asked: (t) => `Asked Md. Hasan for a ${t(order.advance)} bKash advance`,
    confirmed: `Order #${order.number} confirmed`,
  },
}

export const orderTitle = (lang) => words[lang].title

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

const tones = { NEW: 'attention', CONFIRMED: 'info' }

// Fills container with the order in lang, at status. pane adds the order number and its age above
// the amount, which on a phone the title bar carries instead.
export function showOrder(container, lang, { pane = false, status = 'NEW' } = {}) {
  const t = words[lang]
  const { digits, taka } = globalThis.ebdfy.format
  const d = (n) => digits(n, lang)
  const money = (n) => taka(n, lang)
  const phone = `${order.phone.slice(0, 5)}-${order.phone.slice(5)}`

  const parts = []
  if (pane) parts.push(column(element('eb-heading', { level: '3' }, `#${order.number}`), meta(t.when)))
  parts.push(
    column(
      element('eb-heading', { level: '2' }, money(order.total)),
      row(element('eb-badge', { tone: tones[status] }, t[status]), meta(t.meta)),
    ),
    element('eb-banner', { tone: 'danger' }, t.risk(d, money)),
    element(
      'eb-card',
      {},
      column(
        row(element('eb-avatar', { name: t.customer }), column(text(t.customer), meta(phone))),
        meta(t.history(d)),
        meta(t.address),
      ),
    ),
    element(
      'eb-card',
      { heading: t.items },
      column(
        ...order.items.map((item) =>
          row(
            element('eb-thumbnail', { size: 'small', alt: item.name[lang] }),
            column(
              text(item.name[lang]),
              meta([item.detail?.[lang], `${d(item.quantity)} × ${money(item.price)}`].filter(Boolean).join(' · ')),
            ),
            text(money(item.quantity * item.price)),
          ),
        ),
        element('eb-divider'),
        row(meta(t.delivery), text(money(order.delivery))),
      ),
    ),
  )
  container.replaceChildren(...parts)
}

// The two actions on the order, in lang: ask the customer for an advance, or confirm.
export function orderActions(lang, onConfirm) {
  const t = words[lang]
  const { taka } = globalThis.ebdfy.format
  const ask = element('eb-button', { variant: 'secondary', 'full-width': '' }, t.ask)
  ask.addEventListener('click', () => globalThis.ebdfy.toast(t.asked((n) => taka(n, lang))))
  const confirm = element('eb-button', { variant: 'primary', 'full-width': '' }, t.confirm)
  confirm.addEventListener('click', () => {
    globalThis.ebdfy.toast(t.confirmed)
    onConfirm?.()
  })
  return [ask, confirm]
}
