// The playground's report results: what the Admin's Worker answers a report builder's result address
// with, worked out from a made-up store's orders. The 30 days to 13 Nov 2026 hold 474 orders and
// ৳9,87,156, as the Reports page's cards say, and Facebook and Messenger hold 233 of them and
// ৳4,52,562. Words are English with their Bangla in data-bn, as on every playground page.
import { DISTRICTS } from './geo/districts.ts'

type Words = [en: string, bn: string]
// A value of a dimension: its field value, its words, and its share of orders and of net sales.
type Value = [value: string, en: string, bn: string, orders: number, net?: number]

// The channels' own orders and net sales over the 30 days; every other dimension is a share.
const channels: Value[] = [
  ['FACEBOOK', 'Facebook', 'ফেসবুক', 158, 309870],
  ['MESSENGER', 'Messenger', 'মেসেঞ্জার', 75, 142692],
  ['ONLINE_STORE', 'Online store', 'অনলাইন স্টোর', 112, 271460],
  ['PHONE', 'Phone', 'ফোন', 52, 113526],
  ['WHATSAPP', 'WhatsApp', 'হোয়াটসঅ্যাপ', 38, 74250],
  ['INSTAGRAM', 'Instagram', 'ইনস্টাগ্রাম', 21, 44880],
  ['IN_PERSON', 'In person', 'সরাসরি', 8, 17940],
  ['OTHER', 'Other', 'অন্যান্য', 10, 12538],
]

const districtShares = new Map([
  ['Dhaka', 40],
  ['Chattogram', 14],
  ['Gazipur', 9],
  ['Narayanganj', 7],
  ['Sylhet', 6],
  ['Cumilla', 5],
  ['Rajshahi', 5],
  ['Khulna', 4],
  ['Bogura', 3],
  ['Mymensingh', 3],
  ['Rangpur', 2],
  ['Barishal', 2],
])

const dimensions = new Map<string, { label: Words; values: Value[] }>(
  Object.entries({
    CHANNEL: { label: ['Channel', 'চ্যানেল'], values: channels },
    DISTRICT: {
      label: ['District', 'জেলা'],
      values: DISTRICTS.map(({ name, nameBn }) => [name, name, nameBn, districtShares.get(name) ?? 0]),
    },
    PAYMENT_METHOD: {
      label: ['Payment method', 'পেমেন্ট পদ্ধতি'],
      values: [
        ['COD', 'Cash on delivery', 'ক্যাশ অন ডেলিভারি', 62],
        ['BKASH', 'bKash', 'বিকাশ', 21],
        ['NAGAD', 'Nagad', 'নগদ', 9],
        ['CASH', 'Cash', 'ক্যাশ', 4],
        ['BANK', 'Bank', 'ব্যাংক', 3],
        ['OTHER', 'Other', 'অন্যান্য', 1],
      ],
    },
    COURIER: {
      label: ['Courier', 'কুরিয়ার'],
      values: [
        ['PATHAO', 'Pathao', 'পাঠাও', 44],
        ['STEADFAST', 'Steadfast', 'স্টেডফাস্ট', 38],
        ['REDX', 'RedX', 'রেডএক্স', 12],
        ['PAPERFLY', 'Paperfly', 'পেপারফ্লাই', 6],
      ],
    },
    PRODUCT: {
      label: ['Product', 'পণ্য'],
      values: [
        ['cotton-saree', 'Cotton saree', 'সুতি শাড়ি', 30],
        ['three-piece', 'Three-piece', 'থ্রি-পিস', 22],
        ['panjabi', 'Panjabi', 'পাঞ্জাবি', 18],
        ['jamdani-saree', 'Jamdani saree', 'জামদানি শাড়ি', 16],
        ['lungi', 'Lungi', 'লুঙ্গি', 14],
      ],
    },
  }),
)

// The filter each dimension is asked by, in the result address and the form.
const filters = new Map([
  ['CHANNEL', 'channel'],
  ['DISTRICT', 'district'],
  ['PAYMENT_METHOD', 'paymentMethod'],
  ['COURIER', 'courier'],
])

const metrics = new Map<string, Words>(
  Object.entries({
    NET_SALES: ['Net sales', 'নিট বিক্রি'],
    ORDERS: ['Orders', 'অর্ডার'],
    UNITS_SOLD: ['Units sold', 'বিক্রিত ইউনিট'],
    GROSS_PROFIT: ['Gross profit', 'মোট লাভ'],
  }),
)

// Each day's net sales from 15 Oct to 13 Nov 2026, the Reports page's chart; earlier days repeat them.
const daily = [
  36040, 39150, 39450, 36390, 34820, 28620, 28620, 31300, 34220, 34960, 25856, 32960, 28620, 30490, 34750, 38750, 39930,
  37710, 36870, 31210, 31430, 33870, 36120, 35890, 32820, 31830, 26740, 28140, 32180, 17420,
]
const dayMs = 86_400_000
export const today = Date.UTC(2026, 10, 13)
const first = today - 29 * dayMs
const month = daily.reduce((sum, one) => sum + one, 0)

const presets = new Map(Object.entries({ TODAY: 1, YESTERDAY: 1, LAST_7_DAYS: 7, LAST_30_DAYS: 30, LAST_90_DAYS: 90 }))
// The longest custom range, both ends counted.
export const longestRange = 366

const months: Words[] = [
  ['Jan', 'জানু'],
  ['Feb', 'ফেব্রু'],
  ['Mar', 'মার্চ'],
  ['Apr', 'এপ্রি'],
  ['May', 'মে'],
  ['Jun', 'জুন'],
  ['Jul', 'জুলা'],
  ['Aug', 'আগ'],
  ['Sep', 'সেপ্টে'],
  ['Oct', 'অক্টো'],
  ['Nov', 'নভে'],
  ['Dec', 'ডিসে'],
]

const banglaDigits = (text: string) => text.replace(/\d/g, (d) => String.fromCharCode(0x09e6 + Number(d)))
const count = (n: number): Words => [n.toLocaleString('en-IN'), banglaDigits(n.toLocaleString('en-IN'))]
const taka = (n: number): Words => {
  const [en, bn] = count(n)
  return [`৳${en}`, `৳${bn}`]
}

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
// Text in English with its Bangla beside it, as an element's content or an attribute.
const say = ([en, bn]: Words) => ` data-bn="${escape(bn)}">${escape(en)}`
const attr = (name: string, [en, bn]: Words) => ` ${name}="${escape(en)}" data-bn-${name}="${escape(bn)}"`

// Splits total into whole parts in proportion to weights, the largest remainders rounded up, so the
// parts add up to the total.
function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((all, one) => all + one, 0)
  if (sum === 0) return weights.map(() => 0)
  const exact = weights.map((one) => (total * one) / sum)
  const parts = exact.map(Math.floor)
  const order = exact.map((one, at) => [one - Math.floor(one), at] as const).sort((a, b) => b[0] - a[0])
  for (let left = total - parts.reduce((all, one) => all + one, 0), i = 0; left > 0; left--, i++) {
    const at = order[i % order.length]?.[1] ?? 0
    parts[at] = (parts[at] ?? 0) + 1
  }
  return parts
}

// The days a range covers, oldest first, or null for a custom range the API would refuse.
function daysOf(query: URLSearchParams): number[] | null {
  const range = query.get('range') ?? 'LAST_30_DAYS'
  if (range === 'CUSTOM') {
    const from = Date.parse(`${query.get('from')}T00:00:00Z`)
    const to = Date.parse(`${query.get('to')}T00:00:00Z`)
    const length = (to - from) / dayMs + 1
    if (!(length >= 1 && length <= longestRange)) return null
    return Array.from({ length }, (_, i) => from + i * dayMs)
  }
  const length = presets.get(range) ?? 30
  const last = range === 'YESTERDAY' ? today - dayMs : today
  return Array.from({ length }, (_, i) => last - (length - 1 - i) * dayMs)
}

// A day's share of a month's sales; a day after today has none.
const weightOf = (day: number) => (day > today ? 0 : (daily[((((day - first) / dayMs) % 30) + 30) % 30] ?? 0))

const dayWords = (day: number): Words => {
  const date = new Date(day)
  const [en, bn] = months[date.getUTCMonth()] ?? ['', '']
  return [`${date.getUTCDate()} ${en}`, `${banglaDigits(String(date.getUTCDate()))} ${bn}`]
}

interface Row {
  words: Words
  orders: number
  value: number
  today?: boolean
}

// A step for the chart's axis: the smallest of 1, 2, 2.5 and 5 times a power of ten at least n.
function niceStep(n: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(n, 1)))
  return ([1, 2, 2.5, 5, 10].find((one) => one * power >= n) ?? 10) * power
}

/** The HTML of an e-report-result for a result address's query, or null for one the API refuses. */
export function reportResult(query: URLSearchParams): string | null {
  const metric = metrics.has(query.get('metric') ?? '') ? (query.get('metric') ?? '') : 'NET_SALES'
  const groupBy = dimensions.has(query.get('groupBy') ?? '') ? (query.get('groupBy') ?? '') : 'DAY'
  const days = daysOf(query)
  if (!days) return null
  const chosen = (dimension: string) => {
    const name = filters.get(dimension) ?? ''
    const picked = query.getAll(name)
    const values = dimensions.get(dimension)?.values ?? []
    return picked.length ? values.filter(([value]) => picked.includes(value)) : values
  }
  const share = (dimension: string) => {
    const all = (dimensions.get(dimension)?.values ?? []).reduce((sum, value) => sum + value[3], 0)
    return chosen(dimension).reduce((sum, value) => sum + value[3], 0) / all
  }
  const dayWeights = days.map(weightOf)
  let factor = dayWeights.reduce((sum, one) => sum + one, 0) / month
  for (const dimension of ['DISTRICT', 'PAYMENT_METHOD', 'COURIER']) factor *= share(dimension)
  const sales = chosen('CHANNEL')
  const orders = Math.round(sales.reduce((sum, one) => sum + one[3], 0) * factor)
  const net = Math.round(sales.reduce((sum, one) => sum + (one[4] ?? 0), 0) * factor)
  const total =
    {
      NET_SALES: net,
      ORDERS: orders,
      UNITS_SOLD: Math.round(orders * 1.29),
      GROSS_PROFIT: Math.round(net * 0.31),
    }[metric] ?? net
  const byNet = metric === 'NET_SALES' || metric === 'GROSS_PROFIT'

  let rows: Row[]
  if (groupBy === 'DAY') {
    const orderParts = split(orders, dayWeights)
    const valueParts = split(total, dayWeights)
    rows = days.map((day, at) => ({
      words: dayWords(day),
      orders: orderParts[at] ?? 0,
      value: valueParts[at] ?? 0,
      today: day === today,
    }))
  } else {
    const values = groupBy === 'CHANNEL' ? sales : chosen(groupBy)
    const orderParts = split(
      orders,
      values.map((one) => one[3]),
    )
    const valueParts = split(
      total,
      values.map((one) => (byNet ? (one[4] ?? one[3]) : one[3])),
    )
    rows = values

      .map(([, en, bn], at): Row => ({ words: [en, bn], orders: orderParts[at] ?? 0, value: valueParts[at] ?? 0 }))
      .filter((row) => row.orders > 0)
      .sort((a, b) => b.value - a.value)
  }

  const metricWords = metrics.get(metric) ?? ['', '']
  const groupWords = groupBy === 'DAY' ? (['Day', 'দিন'] satisfies Words) : (dimensions.get(groupBy)?.label ?? ['', ''])
  const label: Words = [
    `${metricWords[0]} by ${groupWords[0].toLowerCase()}`,
    `${groupWords[1]}ভিত্তিক ${metricWords[1]}`,
  ]
  const format = byNet ? taka : count
  const view = query.get('view') === 'CHART' ? 'CHART' : 'TABLE'
  if (orders === 0) {
    return `<e-report-result view="${view}"><e-empty-state${attr('heading', ['No orders match these choices', 'এই বাছাইয়ে কোনো অর্ডার নেই'])}><e-text tone="subdued"${say(['Pick a longer range or fewer filters.', 'আরও লম্বা সময় বা কম ফিল্টার বাছুন।'])}</e-text></e-empty-state></e-report-result>`
  }
  const ordersWords: Words =
    metric === 'ORDERS' ? count(orders) : [`${count(orders)[0]} orders`, `${count(orders)[1]}টি অর্ডার`]
  const totalLine: Words =
    metric === 'ORDERS'
      ? [`Total: ${ordersWords[0]}`, `মোট: ${ordersWords[1]}`]
      : [`Total: ${ordersWords[0]}, ${format(total)[0]}`, `মোট: ${ordersWords[1]}, ${format(total)[1]}`]

  if (view === 'CHART') {
    const step = niceStep(Math.max(...rows.map((row) => row.value)) / 4)
    const steps = [4, 3, 2, 1].map((n) => `<e-chart-step${say(format(n * step))}</e-chart-step>`)
    const middle = Math.floor(rows.length / 2)
    const bars = rows.map((row, at) => {
      const tick = rows.length <= 12 || at === 0 || at === middle || at === rows.length - 1
      const share = Math.round((row.value / (4 * step)) * 10_000) / 10_000
      return `<e-chart-bar${attr('label', row.words)}${tick ? ' tick' : ''}${row.today ? ' today' : ''} style="--e-share: ${share}"${say(format(row.value))}</e-chart-bar>`
    })
    return `<e-report-result view="CHART"><e-chart${attr('label', label)}${attr('total', format(total))}><span slot="key"${say(metricWords)}</span>${steps.join('')}${bars.join('')}</e-chart><e-text tone="subdued" data-part="total"${say(totalLine)}</e-text></e-report-result>`
  }

  const withOrders = metric !== 'ORDERS'
  const cells = (row: Words[]) =>
    row.map((words, at) => `<span${at > 0 ? ' align="end"' : ''}${say(words)}</span>`).join('')
  const head = cells(withOrders ? [groupWords, ['Orders', 'অর্ডার'], metricWords] : [groupWords, metricWords])
  const body = rows.map(
    (row) =>
      `<e-row>${cells(withOrders ? [row.words, count(row.orders), format(row.value)] : [row.words, count(row.orders)])}</e-row>`,
  )
  const foot = cells(withOrders ? [['Total', 'মোট'], count(orders), format(total)] : [['Total', 'মোট'], count(orders)])
  return `<e-report-result view="TABLE"><e-table${attr('label', label)} style="--e-columns: minmax(0, 1fr) repeat(${withOrders ? 2 : 1}, max-content)"><e-row head>${head}</e-row>${body.join('')}<e-row total>${foot}</e-row></e-table></e-report-result>`
}
