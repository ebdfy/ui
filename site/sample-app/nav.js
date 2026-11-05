// The sample app's pages in the Admin's nav, in the page's language. A page sends the list as it
// loads and again when its language changes, each time in place of the last.
export function showNav() {
  const bn = document.documentElement.lang === 'bn'
  globalThis.ebdfy.nav([
    { label: bn ? 'হোম' : 'Home', path: '/home' },
    { label: bn ? 'অর্ডার' : 'Orders', path: '/orders' },
    { label: bn ? 'অর্ডার সেটিংস' : 'Order settings', path: '/orders-settings' },
  ])
}
