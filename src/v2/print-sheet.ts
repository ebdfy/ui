// e-print-sheet: CSS alone draws it, so this file only declares the tag for the docs and the typings.
// It emits no code and src/v2.ts does not import it.

/**
 * One order on one A5 page: the invoice above a dashed cut line and the packing slip below it. The page
 * writes the content in plain HTML; each child is a block, and a `div` of two parts is a row with one
 * at each end. In print a page holding sheets prints them alone, one A5 page each.
 * @tag e-print-sheet
 * @slot - The sheet's content: headings, `h1` to `h3`, `small` for quieter lines, tables with `align="end"` on their figures, and these marked parts.
 * @slot shop - The shop's name.
 * @slot recipient - Who the parcel goes to, larger than the shop's name.
 * @slot phone - A phone number, kept on one line.
 * @slot address - The delivery address.
 * @slot due - The cash to collect, in a box, with the amount in a `b`.
 * @slot cut - The cut line's words, between two dashed lines.
 * @slot tick - A box to tick, one a packing line.
 */
export declare class EPrintSheet extends HTMLElement {}
