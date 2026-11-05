// e-metrics. CSS alone draws it, so this file only declares the tag for the docs and the typings. It
// emits no code and src/v2.ts does not import it.

/**
 * Two to four numbers side by side from 600 px, two by two below. It is static content with no role;
 * wrap it in an element with its own label to name the group. Each child is one metric: a
 * `slot="label"` element, a `strong` number and an optional `slot="change"` element, such as
 * `<span slot="change" tone="up">+12%</span>`. A change takes `tone="up"` or `tone="down"` for a colour.
 * @tag e-metrics
 * @slot - One element for each metric.
 */
export declare class EMetrics extends HTMLElement {}
