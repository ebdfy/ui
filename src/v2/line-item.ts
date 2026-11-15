// e-line-item: CSS alone draws it, so this file only declares the tag for the docs and the typings.
// It emits no code and src/v2.ts does not import it.

/**
 * One order line: a thumbnail, the product and its variant, the quantity and price, and the line's
 * amount. Where the box holding the lines is 480 px or wider it is one row; narrower, the amount
 * sits at the end of the title's line and the variant and price go under the title. A long title
 * wraps. The box holding the lines is a size container, so its width must not come from its content.
 * @tag e-line-item
 * @slot - An optional `e-thumbnail`, 40 px.
 * @slot title - The product, which may hold a link.
 * @slot meta - The variant or SKU, in quiet 13 px.
 * @slot price - The quantity and price, such as "1 × ৳1,450", in tabular figures.
 * @slot amount - The line's amount, in tabular figures at the line's end. Amounts align across lines.
 */
export declare class ELineItem extends HTMLElement {}
