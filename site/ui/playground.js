// The playground's Admin in the staff member's language. Its markup is English with each word's
// Bangla in data-bn, and each attribute's in data-bn-<attribute>; in bn this puts the Bangla in place
// before v2.js builds the fields from their labels, and keeps the English beside it in data-en so a
// switch back can restore it. The Admin itself draws its pages in the staff member's language.
// A block keeps these names out of the page scripts' shared global scope.
{
  const localise = (root) => {
    const bn = document.documentElement.lang === 'bn'
    for (const element of [root, ...root.querySelectorAll('*')]) {
      // A copy, as setting an attribute below adds to the live list.
      for (const { name, value } of Array.from(element.attributes)) {
        if (name === 'data-bn') {
          if (!element.hasAttribute('data-en')) element.setAttribute('data-en', element.textContent)
          element.textContent = bn ? value : element.getAttribute('data-en')
        }
        const attribute = /^data-bn-(.+)$/.exec(name)?.[1]
        if (!attribute) continue
        const english = `data-en-${attribute}`
        if (!element.hasAttribute(english)) element.setAttribute(english, element.getAttribute(attribute) ?? '')
        element.setAttribute(attribute, bn ? value : element.getAttribute(english))
      }
    }
  }
  if (document.documentElement.lang === 'bn') localise(document.body)
  // An Admin page's panel that a move swaps in is put in the language before it goes in.
  document.addEventListener('ebdfy:panel', (event) => {
    if (document.documentElement.lang === 'bn') localise(event.detail.panel)
  })

  // The language control's pressed segment is the page's language. Picking the other turns the app's
  // page at once, and the chrome tells the app; an Admin page loads again, as its fields are built in
  // their language.
  const pressed = () => {
    for (const segment of document.querySelectorAll('[data-lang]')) {
      segment.setAttribute('aria-pressed', String(segment.dataset.lang === document.documentElement.lang))
    }
  }
  pressed()
  document.addEventListener('click', (event) => {
    const segment = event.target instanceof Element ? event.target.closest('[data-lang]') : null
    const next = segment?.dataset.lang
    if (!next || next === document.documentElement.lang) return
    // The pick is made, so the menu or sheet it was made in closes.
    segment.closest('[popover]')?.hidePopover()
    try {
      localStorage.setItem('ebdfy-playground-lang', next)
    } catch {}
    if (!document.querySelector('e-admin-panel > iframe')) return location.reload()
    document.documentElement.lang = next
    localise(document.body)
    pressed()
  })

  // The search modal answers from the playground's sample as the staff member types; the Admin
  // answers from its API.
  const sample = {
    orders: [
      [1042, 'Rahima Akter', 'রহিমা আক্তার', 1930],
      [1041, 'Tanvir Hasan', 'তানভীর হাসান', 3200],
      [1040, 'Nusrat Jahan', 'নুসরাত জাহান', 2450],
      [1039, 'Arif Chowdhury', 'আরিফ চৌধুরী', 12500],
      [1038, 'Sumaiya Islam', 'সুমাইয়া ইসলাম', 4780],
    ],
    products: [
      ['Jamdani saree', 'জামদানি শাড়ি'],
      ['Cotton panjabi', 'সুতি পাঞ্জাবি'],
      ['Rajshahi silk scarf', 'রাজশাহী সিল্ক স্কার্ফ'],
      ['Leather sandals', 'চামড়ার স্যান্ডেল'],
    ],
  }
  const results = document.querySelector('dialog.e-search .e-search-results')
  const query = document.querySelector('dialog.e-search input[type="search"]')
  const row = (href, title, detail) => {
    const link = document.createElement('a')
    link.href = href
    link.append(title)
    if (detail) {
      const small = document.createElement('small')
      small.textContent = detail
      link.append(small)
    }
    return link
  }
  query?.addEventListener('input', () => {
    const bn = document.documentElement.lang === 'bn'
    const asked = query.value.trim().toLowerCase()
    const has = (...texts) => texts.some((text) => String(text).toLowerCase().includes(asked))
    const taka = (amount) => `৳${amount.toLocaleString(bn ? 'bn-BD' : 'en-IN')}`
    const groups = asked
      ? [
          [
            bn ? 'অর্ডার' : 'Orders',
            sample.orders
              .filter(([number, en, bangla]) => has(number, en, bangla))
              .map(([number, en, bangla, total]) =>
                row(
                  `/playground/orders/${number}`,
                  `${bn ? 'অর্ডার' : 'Order'} #${number}`,
                  `${bn ? bangla : en} · ${taka(total)}`,
                ),
              ),
          ],
          [
            bn ? 'পণ্য' : 'Products',
            sample.products
              .filter((names) => has(...names))
              .map(([en, bangla]) => row('/playground', bn ? bangla : en)),
          ],
          [
            bn ? 'গ্রাহক' : 'Customers',
            sample.orders
              .filter(([, en, bangla]) => has(en, bangla))
              .map(([, en, bangla]) => row('/playground', bn ? bangla : en)),
          ],
        ]
      : []
    const found = groups.filter(([, rows]) => rows.length > 0)
    results.replaceChildren(
      ...found.flatMap(([name, rows]) => {
        const heading = document.createElement('p')
        heading.className = 'e-search-group'
        heading.textContent = name
        return [heading, ...rows]
      }),
    )
    if (asked && found.length === 0) {
      const none = document.createElement('p')
      none.className = 'e-search-group'
      none.textContent = bn ? 'কিছু পাওয়া যায়নি' : 'No results'
      results.append(none)
    }
  })
}
