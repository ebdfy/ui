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
