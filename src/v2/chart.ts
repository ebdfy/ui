// e-chart: CSS alone draws it, so this file only declares the tags for the docs and the typings.
// It emits no code and src/v2.ts does not import it.

/**
 * A column chart of one value a bar, such as net sales a day. The page writes every part, so the
 * chart is drawn in the first frame and the script never moves it: its steps, top to bottom, each
 * label on its gridline, then a bar a value. A screen reader reads the chart's label, each bar's
 * label and value, and the total.
 * @tag e-chart
 * @attr label - The chart's name for a screen reader, such as `Net sales a day`.
 * @attr total - The total, shown large at the top, such as `৳9,87,156`.
 * @slot key - The series' name, shown at the top end beside a swatch of its bar.
 * @slot - Its `e-chart-step`s, top to bottom, then its `e-chart-bar`s in order.
 */
export declare class EChart extends HTMLElement {}

/**
 * One step of a chart's axis: its text is the label on the step's gridline. The first step is the
 * top of the axis, and the steps share the axis evenly down to its foot at zero, so four steps of
 * ৳40,000 to ৳10,000 draw lines at 40, 30, 20 and 10 thousand.
 * @tag e-chart-step
 * @slot - The step's label, such as `৳40,000`.
 */
export declare class EChartStep extends HTMLElement {}

/**
 * One bar of a chart, 68% of its step wide with 2 px top corners. Its text is its value, which only
 * a screen reader reads; its height is the share of the axis the page writes in its style, as
 * `style="--e-share: 0.62"` for ৳24,800 on an axis of ৳40,000.
 * @tag e-chart-bar
 * @attr label - The bar's date or name, read before its value.
 * @attr {boolean} tick - Shows the label under the axis, as for the first, middle and last day.
 * @attr {boolean} today - Draws the bar in lime, for today.
 * @slot - The bar's value as text, such as `৳17,420`.
 */
export declare class EChartBar extends HTMLElement {}
