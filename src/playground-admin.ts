// The playground's own Admin pages, drawn straight in the panel: Settings' pages and the Orders
// area's sub-pages. Every other address under /playground is a page of the sample app.
export interface AdminPage {
  path: string
  en: string
  bn: string
  icon?: string
}

export const settingsPages: AdminPage[] = [
  { path: '/playground/settings/store', en: 'Store', bn: 'স্টোর', icon: 'store' },
  { path: '/playground/settings/staff', en: 'Staff', bn: 'স্টাফ', icon: 'users' },
  { path: '/playground/settings/payments', en: 'Payments', bn: 'পেমেন্ট', icon: 'credit-card' },
  { path: '/playground/settings/delivery', en: 'Delivery', bn: 'ডেলিভারি', icon: 'truck' },
  { path: '/playground/settings/locations', en: 'Locations', bn: 'লোকেশন', icon: 'map-pin' },
  { path: '/playground/settings/languages', en: 'Languages', bn: 'ভাষা', icon: 'languages' },
  { path: '/playground/settings/policies', en: 'Policies', bn: 'নীতিমালা', icon: 'file-text' },
  { path: '/playground/settings/custom-data', en: 'Custom data', bn: 'কাস্টম ডেটা', icon: 'database' },
  { path: '/playground/settings/developers', en: 'Developers', bn: 'ডেভেলপার', icon: 'code' },
  { path: '/playground/settings/exports', en: 'Exports', bn: 'এক্সপোর্ট', icon: 'download' },
  { path: '/playground/settings/account', en: 'Account and security', bn: 'অ্যাকাউন্ট ও নিরাপত্তা', icon: 'lock' },
]

export const ordersPages: AdminPage[] = [
  { path: '/playground/orders/drafts', en: 'Drafts', bn: 'ড্রাফট' },
  { path: '/playground/orders/returns', en: 'Returns', bn: 'রিটার্ন' },
  { path: '/playground/orders/parcels', en: 'Parcels', bn: 'পার্সেল' },
]

export const isAdminPage = (path: string): boolean =>
  [...settingsPages, ...ordersPages].some((page) => page.path === path)
