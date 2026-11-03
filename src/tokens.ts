import { css } from 'lit'

// The Ink look as semantic design tokens, in OKLCH: hue 85 for the warm neutrals, 268 for
// interaction only. Components read only these properties, never a raw value, so the dark theme
// redefines the same names.
const light = css`
  color-scheme: light;
  --eb-color-bg: oklch(0.985 0.002 85);
  --eb-color-surface: oklch(1 0 0);
  --eb-color-surface-2: oklch(0.972 0.003 85);
  --eb-color-surface-3: oklch(0.952 0.004 85);
  --eb-color-divider: oklch(0.925 0.004 85);
  --eb-color-edge: oklch(0.87 0.005 85);
  --eb-color-control: oklch(0.645 0.006 85);
  --eb-color-text: oklch(0.21 0.006 85);
  --eb-color-text-2: oklch(0.47 0.008 85);
  --eb-color-text-3: oklch(0.54 0.008 85);
  --eb-color-primary: oklch(0.21 0.006 85);
  --eb-color-primary-hi: oklch(0.32 0.006 85);
  --eb-color-on-primary: oklch(0.99 0 0);
  --eb-color-accent: oklch(0.52 0.19 268);
  --eb-color-accent-soft: oklch(0.96 0.022 268);
  --eb-color-focus: oklch(0.52 0.19 268);
  --eb-color-new: oklch(0.66 0.16 58);
  --eb-color-new-bg: oklch(0.955 0.04 72);
  --eb-color-new-fg: oklch(0.46 0.13 50);
  --eb-color-shipped: oklch(0.58 0.1 200);
  --eb-color-paid: oklch(0.58 0.14 150);
  --eb-color-danger: oklch(0.55 0.2 27);
  --eb-color-on-danger: oklch(1 0 0);
  --eb-color-danger-text: oklch(0.49 0.19 27);
  --eb-color-danger-soft: oklch(0.965 0.025 25);
  --eb-color-danger-edge: oklch(0.82 0.08 25);
  --eb-color-scrim: oklch(0.2 0.01 85 / 0.4);
  --eb-color-inverse: oklch(0.22 0.006 85);
  --eb-color-on-inverse: oklch(0.97 0 0);
  --eb-color-inverse-act: oklch(0.82 0.1 268);
  --eb-color-inverse-edge: transparent;
  --eb-color-knob: oklch(1 0 0);
  --eb-color-chrome: oklch(0.972 0.003 85);
  --eb-color-chrome-active: oklch(0.935 0.004 85);
  --eb-color-overlay-edge: oklch(0.925 0.004 85);
  --eb-shadow-1: 0 1px 2px oklch(0.2 0.01 85 / 0.06);
  --eb-shadow-2: 0 1px 2px oklch(0.2 0.01 85 / 0.05), 0 4px 12px oklch(0.2 0.01 85 / 0.07);
  --eb-shadow-3: 0 2px 4px oklch(0.2 0.01 85 / 0.06), 0 16px 40px oklch(0.2 0.01 85 / 0.14);
  --eb-shadow-button: inset 0 1px 0 oklch(1 0 0 / 0.14), 0 1px 2px oklch(0 0 0 / 0.24), 0 0 0 1px oklch(0.15 0.005 85);
`

const dark = css`
  color-scheme: dark;
  --eb-color-bg: oklch(0.16 0.004 85);
  --eb-color-surface: oklch(0.2 0.004 85);
  --eb-color-surface-2: oklch(0.23 0.004 85);
  --eb-color-surface-3: oklch(0.29 0.005 85);
  --eb-color-divider: oklch(0.285 0.005 85);
  --eb-color-edge: oklch(0.35 0.006 85);
  --eb-color-control: oklch(0.52 0.006 85);
  --eb-color-text: oklch(0.955 0.003 85);
  --eb-color-text-2: oklch(0.75 0.006 85);
  --eb-color-text-3: oklch(0.66 0.006 85);
  --eb-color-primary: oklch(0.955 0.003 85);
  --eb-color-primary-hi: oklch(0.86 0.003 85);
  --eb-color-on-primary: oklch(0.17 0.004 85);
  --eb-color-accent: oklch(0.72 0.14 268);
  --eb-color-accent-soft: oklch(0.3 0.06 268);
  --eb-color-focus: oklch(0.74 0.13 268);
  --eb-color-new: oklch(0.76 0.14 65);
  --eb-color-new-bg: oklch(0.31 0.06 60);
  --eb-color-new-fg: oklch(0.88 0.09 72);
  --eb-color-shipped: oklch(0.74 0.1 200);
  --eb-color-paid: oklch(0.74 0.13 150);
  --eb-color-danger: oklch(0.55 0.2 27);
  --eb-color-on-danger: oklch(1 0 0);
  --eb-color-danger-text: oklch(0.8 0.11 27);
  --eb-color-danger-soft: oklch(0.29 0.07 25);
  --eb-color-danger-edge: oklch(0.45 0.12 25);
  --eb-color-scrim: oklch(0 0 0 / 0.6);
  --eb-color-inverse: oklch(0.29 0.005 85);
  --eb-color-on-inverse: oklch(0.97 0 0);
  --eb-color-inverse-act: oklch(0.82 0.1 268);
  --eb-color-inverse-edge: oklch(0.35 0.006 85);
  --eb-color-knob: oklch(1 0 0);
  --eb-color-chrome: oklch(0.18 0.004 85);
  --eb-color-chrome-active: oklch(0.25 0.005 85);
  --eb-color-overlay-edge: oklch(0.35 0.006 85);
  --eb-shadow-1: 0 1px 2px oklch(0 0 0 / 0.45);
  --eb-shadow-2: inset 0 1px 0 oklch(1 0 0 / 0.04), 0 4px 14px oklch(0 0 0 / 0.45);
  --eb-shadow-3: inset 0 1px 0 oklch(1 0 0 / 0.06), 0 18px 48px oklch(0 0 0 / 0.6);
  --eb-shadow-button: inset 0 -1px 0 oklch(0 0 0 / 0.12), 0 1px 2px oklch(0 0 0 / 0.5);
`

// The v1 names, kept until the milestones that restyle their components retire them. They sit on
// every theme root so each resolves against the theme in force there.
const aliases = css`
  --eb-color-ground: var(--eb-color-bg);
  --eb-color-on-accent: var(--eb-color-on-primary);
  --eb-color-bar: var(--eb-color-surface-2);
  --eb-color-on-bar: var(--eb-color-text);
  --eb-color-text-muted: var(--eb-color-text-2);
  --eb-color-line: var(--eb-color-divider);
  --eb-color-line-strong: var(--eb-color-control);
  --eb-color-critical: var(--eb-color-danger-text);
  --eb-color-attention-surface: var(--eb-color-new-bg);
  --eb-color-attention-text: var(--eb-color-new-fg);
  --eb-color-info-surface: var(--eb-color-surface-3);
  --eb-color-info-text: var(--eb-color-text-2);
  --eb-color-success-surface: var(--eb-color-surface-3);
  --eb-color-success-text: var(--eb-color-text);
  --eb-color-shipped-surface: var(--eb-color-surface-3);
  --eb-color-shipped-text: var(--eb-color-text);
  --eb-color-critical-surface: var(--eb-color-danger-soft);
  --eb-color-critical-text: var(--eb-color-danger-text);
  --eb-shadow-card: 0 0 0 1px var(--eb-color-divider), var(--eb-shadow-1);
`

// The device's theme by default; data-theme="light" or "dark" on the root, or on any element
// around a part of the page, forces one.
export const tokens = css`
  :root,
  [data-theme='light'] {
    ${light}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      ${dark}
    }
  }
  [data-theme='dark'] {
    ${dark}
  }
  :root,
  [data-theme] {
    ${aliases}
  }
  :root {
    --eb-font-size-caption: 12px;
    --eb-line-height-caption: 16px;
    --eb-font-size-meta: 13px;
    --eb-line-height-meta: 20px;
    --eb-font-size-body: 14px;
    --eb-line-height-body: 20px;
    --eb-font-size-heading-3: 17px;
    --eb-line-height-heading-3: 24px;
    --eb-font-size-heading-2: 22px;
    --eb-line-height-heading-2: 32px;
    --eb-font-size-heading-1: 30px;
    --eb-line-height-heading-1: 40px;
    --eb-font-weight-regular: 400;
    --eb-font-weight-medium: 500;
    --eb-font-weight-semibold: 600;
    --eb-font-weight-bold: 650;
    --eb-font-size-title: var(--eb-font-size-heading-2);
    --eb-font-size-card-title: var(--eb-font-size-heading-3);
    --eb-font-size-badge: var(--eb-font-size-meta);
    --eb-line-height-heading: var(--eb-line-height-heading-3);
  }
  @media (max-width: 640px) {
    :root {
      --eb-font-size-body: 15px;
      --eb-line-height-body: 24px;
    }
  }
  /* Bangla is never below 13 px or a 1.4 line height: the caption grows to the meta size and the
     largest heading opens its lines. Latin inside a Bangla page goes back to the scale. */
  [lang|='bn'] {
    --eb-font-size-caption: 13px;
    --eb-line-height-caption: 20px;
    --eb-line-height-heading-1: 42px;
  }
  [lang]:not([lang|='bn']) {
    --eb-font-family: 'Geist', 'Noto Sans Bengali', system-ui, sans-serif;
    --eb-font-size-caption: 12px;
    --eb-line-height-caption: 16px;
    --eb-line-height-heading-1: 40px;
  }
  :root {
    --eb-radius-sm: 6px;
    --eb-radius-md: 8px;
    --eb-radius-lg: 12px;
    --eb-radius-card: 12px;
    --eb-radius-field: 8px;
    --eb-radius-pill: 999px;
    --eb-space-card: 16px;
    --eb-space-gap: 12px;
    --eb-size-control-sm: 28px;
    --eb-size-control-md: 36px;
    --eb-size-control-lg: 44px;
    --eb-size-target: 44px;
    --eb-font-family: 'Geist', 'Noto Sans Bengali', system-ui, sans-serif;
  }
  /* Bangla takes Geist for letters and digits only: its file has no comma, which would load Geist. */
  [lang|='bn'] {
    --eb-font-family: 'Noto Sans Bengali', 'Geist Letters', system-ui, sans-serif;
  }
`

// The keyboard focus ring every interactive part shows, and only for keyboard focus.
export const focusRing = css`
  :focus-visible {
    outline: 2px solid var(--eb-color-focus);
    outline-offset: 2px;
  }
`

// Adds the design tokens to the document once, ahead of any stylesheet the page has adopted.
export function installTokens(doc: Document = document): void {
  const sheet = tokens.styleSheet
  if (!sheet || doc.adoptedStyleSheets.includes(sheet)) return
  doc.adoptedStyleSheets = [sheet, ...doc.adoptedStyleSheets]
}
