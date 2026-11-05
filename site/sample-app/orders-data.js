// The sample app's orders, standing in for its backend: 120 orders placed from 3 November to today
// at 11:24, newest #1042. A classic script, so a page can read it before its first paint; it sets
// globalThis.sampleOrders. Words come in English and Bangla. Order numbers stay in Latin digits in
// both, as identifiers do; counts, times and totals follow the language.
{
  const words = {
    en: {
      today: 'Today',
      yesterday: 'Yesterday',
      nov3: '3 Nov',
      items: (n) => (n === 1 ? '1 item' : `${n} items`),
      status: {
        new: 'New',
        confirmed: 'Confirmed',
        courier: 'With courier',
        delivered: 'Delivered',
        returned: 'Returned',
      },
      channel: { facebook: 'Facebook', website: 'Website', instagram: 'Instagram', phone: 'Phone' },
      payment: {
        cod: 'Cash on delivery',
        bkash: 'bKash · Paid',
        nagad: 'Nagad · Paid',
        card: 'Card · Paid',
      },
    },
    bn: {
      today: 'আজ',
      yesterday: 'গতকাল',
      nov3: '৩ নভেম্বর',
      items: (n) => `${digits(n, 'bn')}টি পণ্য`,
      status: {
        new: 'নতুন',
        confirmed: 'কনফার্মড',
        courier: 'কুরিয়ারে',
        delivered: 'ডেলিভারি হয়েছে',
        returned: 'ফেরত এসেছে',
      },
      channel: { facebook: 'ফেসবুক', website: 'ওয়েবসাইট', instagram: 'ইনস্টাগ্রাম', phone: 'ফোন' },
      payment: {
        cod: 'ক্যাশ অন ডেলিভারি',
        bkash: 'বিকাশ · পরিশোধিত',
        nagad: 'নগদ · পরিশোধিত',
        card: 'কার্ড · পরিশোধিত',
      },
    },
  }

  // The kit's ebdfy.format does the same once v2.js has run; the order page draws before it does.
  const grouped = { en: new Intl.NumberFormat('en-IN'), bn: new Intl.NumberFormat('bn-IN') }
  function digits(value, lang) {
    return grouped[lang].format(value)
  }

  // The ten newest, as the list's first page shows them: one of each status among them.
  const newest = [
    [1042, 'Rahima Akter', 'রহিমা আক্তার', 'facebook', 'cod', 'new', 2, 1930],
    [1041, 'Tanvir Hasan', 'তানভীর হাসান', 'website', 'bkash', 'confirmed', 3, 3200],
    [1040, 'Nusrat Jahan', 'নুসরাত জাহান', 'facebook', 'cod', 'new', 2, 2450],
    [1039, 'Arif Chowdhury', 'আরিফ চৌধুরী', 'phone', 'cod', 'courier', 4, 12500],
    [1038, 'Sumaiya Islam', 'সুমাইয়া ইসলাম', 'instagram', 'card', 'delivered', 2, 4780],
    [1037, 'Mahmudul Karim', 'মাহমুদুল করিম', 'facebook', 'cod', 'returned', 1, 990],
    [1036, 'Farzana Rahman', 'ফারজানা রহমান', 'website', 'bkash', 'delivered', 3, 6320],
    [1035, 'Imran Hossain', 'ইমরান হোসেন', 'facebook', 'cod', 'courier', 1, 1450],
    [1034, 'Sadia Afrin', 'সাদিয়া আফরিন', 'instagram', 'nagad', 'new', 2, 2890],
    [1033, 'Rakib Uddin', 'রাকিব উদ্দিন', 'phone', 'bkash', 'confirmed', 6, 112400],
  ]

  // The other 110 come from these lists, the same every load. None is named Rahima, so a search for
  // her finds #1042 alone.
  const first = [
    ['Nasrin', 'নাসরিন'],
    ['Tanvir', 'তানভীর'],
    ['Mitu', 'মিতু'],
    ['Shakil', 'শাকিল'],
    ['Jannat', 'জান্নাত'],
    ['Habib', 'হাবিব'],
    ['Ayesha', 'আয়েশা'],
    ['Rafiq', 'রফিক'],
    ['Lima', 'লিমা'],
    ['Sohel', 'সোহেল'],
    ['Taslima', 'তাসলিমা'],
    ['Kamal', 'কামাল'],
    ['Rupa', 'রুপা'],
  ]
  const last = [
    ['Ahmed', 'আহমেদ'],
    ['Begum', 'বেগম'],
    ['Sarkar', 'সরকার'],
    ['Mia', 'মিয়া'],
    ['Khatun', 'খাতুন'],
    ['Talukder', 'তালুকদার'],
    ['Sultana', 'সুলতানা'],
  ]
  const channels = ['facebook', 'facebook', 'website', 'instagram', 'facebook', 'phone']
  const payments = ['cod', 'cod', 'bkash', 'cod', 'nagad', 'cod', 'card']

  // Beyond the first page, the 28 still from today are new, confirmed or with the courier; the 82
  // from 3 and 4 November are with the courier, delivered or returned. Each list is spread through
  // its days by a fixed stride, so the tabs' counts are New 12, Confirmed 18, With courier 54,
  // Delivered 30 and Returned 6.
  const spread = (counts) => {
    const pool = Object.entries(counts).flatMap(([status, count]) => Array(count).fill(status))
    return pool.map((_, i) => pool[(i * 11) % pool.length])
  }
  const todays = spread({ new: 9, confirmed: 16, courier: 3 })
  const olders = spread({ courier: 49, delivered: 28, returned: 5 })

  const orders = newest.map(([number, en, bn, channel, payment, status, items, total]) => ({
    number,
    customer: { en, bn },
    channel,
    payment,
    status,
    items,
    total,
  }))
  for (let number = 1032; number >= 923; number--) {
    const i = 1032 - number
    const name = first[(i * 5) % first.length]
    const family = last[(i * 3) % last.length]
    orders.push({
      number,
      customer: { en: `${name[0]} ${family[0]}`, bn: `${name[1]} ${family[1]}` },
      channel: channels[i % channels.length],
      payment: payments[i % payments.length],
      status: i < 28 ? todays[i] : olders[i - 28],
      items: 1 + ((i * 7) % 4),
      total: 390 + ((number * 7919) % 97) * 70,
    })
  }

  // Today's 38, #1005 to #1042, every 18 minutes back from 11:24; then 41 from yesterday and 41 from
  // 3 November.
  const placed = (number, lang) => {
    const t = words[lang]
    if (number >= 1005) {
      const minutes = 11 * 60 + 24 - (1042 - number) * 18
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
      const mm = String(minutes % 60).padStart(2, '0')
      const time = lang === 'bn' ? `${hh}:${mm}`.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : `${hh}:${mm}`
      return `${t.today} ${time}`
    }
    return number >= 964 ? t.yesterday : t.nov3
  }

  const taka = (amount, lang) => `৳${digits(amount, lang)}`

  // An order's words in a language, for a list row or an order's page.
  const read = (order, lang) => {
    const t = words[lang]
    return {
      number: `#${order.number}`,
      placed: placed(order.number, lang),
      customer: order.customer[lang],
      channel: t.channel[order.channel],
      payment: t.payment[order.payment],
      status: t.status[order.status],
      items: t.items(order.items),
      total: taka(order.total, lang),
    }
  }

  // One e-row of the orders list, in the page's language: a checkbox to select it, then its cells, each
  // placed on a phone's card by its card attribute; the channel and items stay off the card. Each
  // cell keeps both languages in data-en and data-bn, as the list's markup does, so the page's
  // language switch turns it like the rest; the checkbox keeps its label's two the same way.
  const row = (order, lang) => {
    const en = read(order, 'en')
    const bn = read(order, 'bn')
    const cell = (key, attributes = {}) => {
      const span = document.createElement('span')
      for (const [name, value] of Object.entries(attributes)) span.setAttribute(name, value)
      span.dataset.en = en[key]
      span.dataset.bn = bn[key]
      span.textContent = lang === 'bn' ? bn[key] : en[key]
      return span
    }
    const box = document.createElement('e-checkbox')
    const pick = { en: `Select ${en.number}`, bn: `অর্ডার ${en.number} নির্বাচন করুন` }
    box.setAttribute('label', pick[lang])
    box.setAttribute('hide-label', '')
    box.setAttribute('data-en-label', pick.en)
    box.setAttribute('data-bn-label', pick.bn)
    const select = document.createElement('span')
    select.append(box)
    const link = document.createElement('a')
    link.href = `/orders/${order.number}`
    link.textContent = en.number
    const badge = document.createElement('e-badge')
    badge.setAttribute('tone', order.status)
    badge.dataset.en = en.status
    badge.dataset.bn = bn.status
    badge.textContent = lang === 'bn' ? bn.status : en.status
    const status = document.createElement('span')
    status.setAttribute('card', 'status')
    status.append(badge)
    const number = document.createElement('span')
    number.setAttribute('card', 'title')
    const styled = document.createElement('e-link')
    styled.append(link)
    number.append(styled)
    const tr = document.createElement('e-row')
    tr.dataset.number = order.number
    tr.append(
      select,
      number,
      cell('placed', { tone: 'subdued', card: 'aside' }),
      cell('customer', { card: 'body' }),
      cell('channel'),
      cell('payment', { card: 'meta' }),
      status,
      cell('items', { align: 'end' }),
      cell('total', { align: 'end', card: 'end' }),
    )
    return tr
  }

  globalThis.sampleOrders = { orders, words, read, row, digits, taka }
}
