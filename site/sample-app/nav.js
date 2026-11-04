import { countOrders } from './orders.js'

// Every page of the sample app names its pages for the Admin nav, each with its icon, and Orders
// with how many are new. Sending the same list again on each page replaces it, so the nav never
// doubles.
globalThis.ebdfy.nav([
  { label: 'Orders', path: '/', icon: 'shopping-bag', count: countOrders().new },
  { label: 'Order #1001', path: '/order', icon: 'receipt' },
  { label: 'Order #1039', path: '/order-1039', icon: 'receipt' },
  { label: 'Drafts', path: '/drafts', icon: 'pencil' },
])

// Each page names the store it works on, read through the Admin. Opened on its own, outside the
// Admin, the app has no token to read it with and names none.
const name = await globalThis.ebdfy
  .fetch('{ shop { name } }')
  .then((result) => result.data?.shop?.name ?? '')
  .catch(() => '')
for (const element of document.querySelectorAll('[data-store-name]')) element.textContent = name
