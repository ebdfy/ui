// e-summary, e-summary-row and e-due: CSS alone draws them, so this file only declares the tags for
// the docs and the typings. It emits no code and src/v2.ts does not import it.

/**
 * Rows of a label and a value, such as an order's payment. Put `e-summary-row`s inside, and an `e-due`
 * after them for what is still owed.
 * @tag e-summary
 * @slot - The rows, then an optional `e-due`.
 */
export declare class ESummary extends HTMLElement {}

/**
 * One row: its first child is the label and its last the value, at the row's end. A child between them,
 * such as an item count, reads quieter.
 * @tag e-summary-row
 * @attr {boolean} total - The total row: heavier, under a line.
 * @slot - The label, an optional note, then the value.
 */
export declare class ESummaryRow extends HTMLElement {}

/**
 * What is still owed, as a block in a tone, such as "To collect ৳1,930 on delivery".
 * @tag e-due
 * @attr {'warning' | 'success' | 'critical'} tone - Amber for money still to collect, green for paid, red for overdue. Without it the block is grey.
 * @slot - The sentence.
 */
export declare class EDue extends HTMLElement {}
