// Every page of the sample app names its pages for the Admin nav. Sending the same list again on
// each page replaces it, so the nav never doubles.
globalThis.ebdfy.nav([
  { label: 'Orders', path: '/' },
  { label: 'Order #1001', path: '/order' },
  { label: 'Order #1039', path: '/order-1039' },
  { label: 'Drafts', path: '/drafts' },
])

// Each page names the store it works on, read through the Admin. Opened on its own, outside the
// Admin, the app has no token to read it with and names none.
const name = await globalThis.ebdfy
  .fetch('{ shop { name } }')
  .then((result) => result.data?.shop?.name ?? '')
  .catch(() => '')
for (const element of document.querySelectorAll('[data-store-name]')) element.textContent = name
