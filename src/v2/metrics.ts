// e-metrics. CSS alone draws it, so this file only declares the tag for the docs and the typings. It
// emits no code and src/v2.ts does not import it.

/**
 * Two to four numbers side by side from 600 px, two by two below. It is static content with no role;
 * wrap it in an element with its own label to name the group. Each child is one metric: a
 * `slot="label"` element, a `strong` number and an optional `slot="change"` element, such as
 * `<span slot="change" tone="success">+12%</span>`. A change takes a colour from its tone: `up` and
 * `success` are green, `down` and `critical` are red. Inside an `e-card` the metrics draw no border,
 * background or radius, so they read as a row of figures.
 * @tag e-metrics
 * @attr {'up' | 'down' | 'success' | 'critical'} tone - On a `slot="change"` element: the change's colour.
 * @slot - One element for each metric.
 */
export declare class EMetrics extends HTMLElement {}
