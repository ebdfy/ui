// The orders list's behaviour: the e-index-table draws the tabs, search, filter chips, sort and pager
// and says what a person did; this narrows the sample's orders to match and draws ten at a time. The
// markup already holds the first ten, so nothing is drawn until the person asks for something else.
const size = 10

// The filters Add filter offers, in the order it adds them. Every order is from the last 30 days, so
// the date filter keeps them all; the payment filter keeps cash on delivery.
const filters = {
  date: { en: 'Date: Last 30 days', bn: 'তারিখ: গত ৩০ দিন', keeps: () => true },
  payment: {
    en: 'Payment: Cash on delivery',
    bn: 'পেমেন্ট: ক্যাশ অন ডেলিভারি',
    keeps: (order) => order.payment === 'cod',
  },
}

const lang = () => (document.documentElement.lang === 'bn' ? 'bn' : 'en')

// What the empty list says, after a search and in a view with no orders.
const emptied = {
  search: {
    heading: { en: 'No orders match', bn: 'কোনো অর্ডার মেলেনি' },
    text: { en: 'Try another word, or clear the search.', bn: 'অন্য শব্দে খুঁজুন, অথবা খোঁজা মুছে দিন।' },
  },
  view: {
    heading: { en: 'No orders here', bn: 'এখানে কোনো অর্ডার নেই' },
    text: { en: 'Orders show here as they reach this view.', bn: 'অর্ডার এই ভিউতে এলে এখানে দেখাবে।' },
  },
}

// What each bulk action does to an order's status, and what the toast says of how many it changed.
// Printing labels changes no order.
const acts = {
  confirm: {
    from: ['new'],
    to: 'confirmed',
    en: (n) => `${n === 1 ? '1 order' : `${n} orders`} confirmed`,
    bn: (n) => `${n}টি অর্ডার কনফার্ম হয়েছে`,
    none: { en: 'None of these orders is new', bn: 'এগুলোর কোনোটি নতুন নয়' },
  },
  courier: {
    from: ['new', 'confirmed'],
    to: 'courier',
    en: (n) => `Courier booked for ${n === 1 ? '1 order' : `${n} orders`}`,
    bn: (n) => `${n}টি অর্ডারের কুরিয়ার বুক হয়েছে`,
    none: {
      en: 'None of these orders can go to the courier',
      bn: 'এগুলোর কোনোটি কুরিয়ারে পাঠানো যায় না',
    },
  },
  labels: {
    from: [],
    en: (n) => `Labels for ${n === 1 ? '1 order are' : `${n} orders are`} ready to print`,
    bn: (n) => `${n}টি অর্ডারের লেবেল প্রিন্টের জন্য তৈরি`,
  },
}

// Bangla digits typed in the search read as Latin ones, as order numbers are written.
const latin = (text) => text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6))

function matches(order, words) {
  if (!words) return true
  const number = latin(words).replace(/^#/, '')
  return (
    order.customer.en.toLowerCase().includes(words.toLowerCase()) ||
    order.customer.bn.includes(words) ||
    (/^\d+$/.test(number) && String(order.number).includes(number))
  )
}

export function startList(index) {
  const { orders, row, digits } = globalThis.sampleOrders
  const table = index.querySelector(':scope > e-table')
  const pager = index.querySelector(':scope > e-pagination')
  const add = index.querySelector(':scope > e-button')
  const state = { view: 'all', words: '', sort: 'newest', page: 0, filters: new Set(['date']) }

  const found = () =>
    orders
      .filter((order) => state.view === 'all' || order.status === state.view)
      .filter((order) => [...state.filters].every((name) => filters[name].keeps(order)))
      .filter((order) => matches(order, state.words.trim()))
      .sort((a, b) => (state.sort === 'oldest' ? a.number - b.number : b.number - a.number))

  // An attribute in both languages, as the page's language switch expects to find it.
  const say = (tag, name, en, bn) => {
    tag.setAttribute(`data-en-${name}`, en)
    tag.setAttribute(`data-bn-${name}`, bn)
    tag.setAttribute(name, lang() === 'bn' ? bn : en)
  }
  const range = (from, to, count, language) =>
    language === 'bn'
      ? `${digits(from, 'bn')}–${digits(to, 'bn')}, মোট ${digits(count, 'bn')}`
      : `${from}–${to} of ${digits(count, 'en')}`

  // The empty state speaks to why the list is empty: a search that matched nothing offers to clear it;
  // a view with nothing in it, as a tab whose orders all moved on, just says so.
  const empty = index.querySelector(':scope > e-empty-state')
  const clear = empty.querySelector(':scope > e-button')
  const reason = empty.querySelector(':scope > p')
  const explain = () => {
    const searching = state.words.trim() !== ''
    const words = searching ? emptied.search : emptied.view
    say(empty, 'heading', words.heading.en, words.heading.bn)
    reason.dataset.en = words.text.en
    reason.dataset.bn = words.text.bn
    reason.textContent = words.text[lang()]
    clear.hidden = !searching
  }

  const draw = () => {
    const list = found()
    const last = Math.max(0, Math.ceil(list.length / size) - 1)
    state.page = Math.min(state.page, last)
    const shown = list.slice(state.page * size, (state.page + 1) * size)
    for (const old of table.querySelectorAll(':scope > e-row:not([head])')) old.remove()
    table.append(...shown.map((order) => row(order, lang())))
    const from = shown.length ? state.page * size + 1 : 0
    const to = state.page * size + shown.length
    say(pager, 'label', range(from, to, list.length, 'en'), range(from, to, list.length, 'bn'))
    pager.toggleAttribute('has-previous', state.page > 0)
    pager.toggleAttribute('has-next', state.page < last)
    explain()
  }
  const restart = () => {
    state.page = 0
    draw()
  }

  // Add filter puts back the first filter not in use, as a chip before itself, and rests once every
  // filter is.
  const offer = () => add.toggleAttribute('disabled', state.filters.size === Object.keys(filters).length)
  const chip = (name) => {
    const tag = document.createElement('span')
    tag.slot = 'filter'
    tag.setAttribute('name', name)
    const words = document.createElement('span')
    words.dataset.en = filters[name].en
    words.dataset.bn = filters[name].bn
    words.textContent = filters[name][lang()]
    tag.append(words)
    return tag
  }
  add.addEventListener('click', () => {
    const name = Object.keys(filters).find((one) => !state.filters.has(one))
    if (!name) return
    state.filters.add(name)
    add.before(chip(name))
    offer()
    restart()
  })
  offer()

  index.addEventListener('e-tab-change', ({ detail }) => {
    state.view = detail.value
    restart()
  })
  index.addEventListener('e-filter-remove', ({ detail }) => {
    state.filters.delete(detail.name)
    offer()
    restart()
  })
  index.addEventListener('input', ({ target }) => {
    if (!target.closest('e-search-field')) return
    state.words = target.value
    restart()
  })
  index.addEventListener('change', ({ target }) => {
    if (!target.closest('e-select')) return
    state.sort = target.value
    restart()
  })
  // Each status's count, on its tab and in the metrics that name it, in both languages.
  const recount = () => {
    const counts = { all: orders.length }
    for (const order of orders) counts[order.status] = (counts[order.status] ?? 0) + 1
    for (const tab of index.querySelectorAll('e-tab')) {
      const count = counts[tab.getAttribute('value')] ?? 0
      say(tab, 'count', digits(count, 'en'), digits(count, 'bn'))
    }
    for (const metric of document.querySelectorAll('e-metrics [data-count]')) {
      const count = counts[metric.dataset.count] ?? 0
      metric.dataset.en = digits(count, 'en')
      metric.dataset.bn = digits(count, 'bn')
      metric.textContent = metric.dataset[lang()]
    }
  }

  // A bulk action changes the selected orders it applies to, says how many, and draws the list again,
  // which clears the selection.
  index.querySelector(':scope > [slot="bulk"]').addEventListener('click', ({ target }) => {
    const act = acts[target.closest('[data-act]')?.dataset.act]
    if (!act) return
    const picked = new Set(
      [...table.querySelectorAll(':scope > e-row[selected]')].map((row) => Number(row.dataset.number)),
    )
    const changed = orders.filter((order) => picked.has(order.number) && act.from.includes(order.status))
    for (const order of changed) order.status = act.to
    const count = act.from.length ? changed.length : picked.size
    // An action that changed nothing says why, rather than counting none.
    if (count === 0) globalThis.ebdfy.toast(act.none[lang()])
    else globalThis.ebdfy.toast(lang() === 'bn' ? act.bn(digits(count, 'bn')) : act.en(count))
    recount()
    draw()
    // The bar and the button that had focus are gone with the selection; the search field takes it,
    // once the index table has seen the new rows and shown its toolbar again.
    queueMicrotask(() => index.querySelector(':scope > e-search-field > input')?.focus())
  })

  // Clear search empties the field, lists the orders again and leaves the person in the field.
  index.querySelector(':scope > e-empty-state > e-button').addEventListener('click', () => {
    const field = index.querySelector(':scope > e-search-field')
    field.value = ''
    state.words = ''
    restart()
    field.querySelector('input')?.focus()
  })

  pager.addEventListener('e-previous', () => {
    state.page -= 1
    draw()
  })
  pager.addEventListener('e-next', () => {
    state.page += 1
    draw()
  })
}
