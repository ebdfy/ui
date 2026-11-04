import { svg } from 'lit'

// Icons from Lucide (ISC licence, https://lucide.dev), copied in only as they are used. Ink draws
// them with a 1.5 px stroke that stays 1.5 px at any size.
const icon = (paths: ReturnType<typeof svg>) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const chevronLeft = icon(svg`<path vector-effect="non-scaling-stroke" d="m15 18-6-6 6-6" />`)

export const chevronRight = icon(svg`<path vector-effect="non-scaling-stroke" d="m9 18 6-6-6-6" />`)

export const image = icon(
  svg`<rect vector-effect="non-scaling-stroke" width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle vector-effect="non-scaling-stroke" cx="9" cy="9" r="2" /><path vector-effect="non-scaling-stroke" d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />`,
)

export const triangleAlert = icon(
  svg`<path vector-effect="non-scaling-stroke" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path vector-effect="non-scaling-stroke" d="M12 9v4" /><path vector-effect="non-scaling-stroke" d="M12 17h.01" />`,
)

export const info = icon(
  svg`<circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="10" /><path vector-effect="non-scaling-stroke" d="M12 16v-4" /><path vector-effect="non-scaling-stroke" d="M12 8h.01" />`,
)

export const close = icon(
  svg`<path vector-effect="non-scaling-stroke" d="M18 6 6 18" /><path vector-effect="non-scaling-stroke" d="m6 6 12 12" />`,
)

// The set eb-icon draws, by name. home, more-horizontal and filter are Lucide's house, ellipsis and
// funnel.
export const icons = {
  plus: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M5 12h14" /><path vector-effect="non-scaling-stroke" d="M12 5v14" />`,
  ),
  search: icon(
    svg`<path vector-effect="non-scaling-stroke" d="m21 21-4.34-4.34" /><circle vector-effect="non-scaling-stroke" cx="11" cy="11" r="8" />`,
  ),
  x: close,
  check: icon(svg`<path vector-effect="non-scaling-stroke" d="M20 6 9 17l-5-5" />`),
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-down': icon(svg`<path vector-effect="non-scaling-stroke" d="m6 9 6 6 6-6" />`),
  'more-horizontal': icon(
    svg`<circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="1" /><circle vector-effect="non-scaling-stroke" cx="19" cy="12" r="1" /><circle vector-effect="non-scaling-stroke" cx="5" cy="12" r="1" />`,
  ),
  package: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path vector-effect="non-scaling-stroke" d="M12 22V12" /><polyline vector-effect="non-scaling-stroke" points="3.29 7 12 12 20.71 7" /><path vector-effect="non-scaling-stroke" d="m7.5 4.27 9 5.15" />`,
  ),
  'shopping-bag': icon(
    svg`<path vector-effect="non-scaling-stroke" d="M16 10a4 4 0 0 1-8 0" /><path vector-effect="non-scaling-stroke" d="M3.103 6.034h17.794" /><path vector-effect="non-scaling-stroke" d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />`,
  ),
  truck: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path vector-effect="non-scaling-stroke" d="M15 18H9" /><path vector-effect="non-scaling-stroke" d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle vector-effect="non-scaling-stroke" cx="17" cy="18" r="2" /><circle vector-effect="non-scaling-stroke" cx="7" cy="18" r="2" />`,
  ),
  users: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path vector-effect="non-scaling-stroke" d="M16 3.128a4 4 0 0 1 0 7.744" /><path vector-effect="non-scaling-stroke" d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle vector-effect="non-scaling-stroke" cx="9" cy="7" r="4" />`,
  ),
  user: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle vector-effect="non-scaling-stroke" cx="12" cy="7" r="4" />`,
  ),
  phone: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />`,
  ),
  'message-circle': icon(
    svg`<path vector-effect="non-scaling-stroke" d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />`,
  ),
  printer: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path vector-effect="non-scaling-stroke" d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><rect vector-effect="non-scaling-stroke" x="6" y="14" width="12" height="8" rx="1" />`,
  ),
  copy: icon(
    svg`<rect vector-effect="non-scaling-stroke" width="14" height="14" x="8" y="8" rx="2" ry="2" /><path vector-effect="non-scaling-stroke" d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />`,
  ),
  bell: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M10.268 21a2 2 0 0 0 3.464 0" /><path vector-effect="non-scaling-stroke" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />`,
  ),
  home: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path vector-effect="non-scaling-stroke" d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />`,
  ),
  settings: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="3" />`,
  ),
  store: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" /><path vector-effect="non-scaling-stroke" d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" /><path vector-effect="non-scaling-stroke" d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />`,
  ),
  tag: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle vector-effect="non-scaling-stroke" cx="7.5" cy="7.5" r=".5" fill="currentColor" />`,
  ),
  'credit-card': icon(
    svg`<rect vector-effect="non-scaling-stroke" width="20" height="14" x="2" y="5" rx="2" /><line vector-effect="non-scaling-stroke" x1="2" x2="22" y1="10" y2="10" /><path vector-effect="non-scaling-stroke" d="M6 14h2" />`,
  ),
  banknote: icon(
    svg`<rect vector-effect="non-scaling-stroke" width="20" height="12" x="2" y="6" rx="2" /><circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="2" /><path vector-effect="non-scaling-stroke" d="M6 12h.01M18 12h.01" />`,
  ),
  receipt: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M12 17V7" /><path vector-effect="non-scaling-stroke" d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" /><path vector-effect="non-scaling-stroke" d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />`,
  ),
  image,
  'triangle-alert': triangleAlert,
  info,
  'circle-check': icon(
    svg`<circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="10" /><path vector-effect="non-scaling-stroke" d="m16 9-5.5 5.5L8 12" />`,
  ),
  lock: icon(
    svg`<rect vector-effect="non-scaling-stroke" width="18" height="11" x="3" y="11" rx="2" ry="2" /><path vector-effect="non-scaling-stroke" d="M7 11V7a5 5 0 0 1 10 0v4" />`,
  ),
  'external-link': icon(
    svg`<path vector-effect="non-scaling-stroke" d="M15 3h6v6" /><path vector-effect="non-scaling-stroke" d="M10 14 21 3" /><path vector-effect="non-scaling-stroke" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />`,
  ),
  'arrow-left': icon(
    svg`<path vector-effect="non-scaling-stroke" d="m12 19-7-7 7-7" /><path vector-effect="non-scaling-stroke" d="M19 12H5" />`,
  ),
  filter: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />`,
  ),
  calendar: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M8 2v3" /><path vector-effect="non-scaling-stroke" d="M16 2v3" /><rect vector-effect="non-scaling-stroke" x="3" y="3" width="18" height="18" rx="2" /><path vector-effect="non-scaling-stroke" d="M3 9h18" />`,
  ),
  'map-pin': icon(
    svg`<path vector-effect="non-scaling-stroke" d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle vector-effect="non-scaling-stroke" cx="12" cy="10" r="3" />`,
  ),
  trash: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M10 11v6" /><path vector-effect="non-scaling-stroke" d="M14 11v6" /><path vector-effect="non-scaling-stroke" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path vector-effect="non-scaling-stroke" d="M3 6h18" /><path vector-effect="non-scaling-stroke" d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />`,
  ),
  pencil: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path vector-effect="non-scaling-stroke" d="m15 5 4 4" />`,
  ),
  eye: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle vector-effect="non-scaling-stroke" cx="12" cy="12" r="3" />`,
  ),
  upload: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M12 3v12" /><path vector-effect="non-scaling-stroke" d="m17 8-5-5-5 5" /><path vector-effect="non-scaling-stroke" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />`,
  ),
  download: icon(
    svg`<path vector-effect="non-scaling-stroke" d="M12 15V3" /><path vector-effect="non-scaling-stroke" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path vector-effect="non-scaling-stroke" d="m7 10 5 5 5-5" />`,
  ),
}
