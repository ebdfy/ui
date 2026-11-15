// e-todo. CSS alone draws it, so this file only declares the tag for the docs and the typings. It
// emits no code and src/v2.ts does not import it.

/**
 * A row of counts that are links, such as the orders to confirm or to ship. Each child is an `a` to the
 * list it counts, holding a `strong` count and then the words, such as
 * `<a href="/orders"><strong>12</strong> To confirm</a>`. The tiles share one row from 600 px and sit
 * two by two below. It has no role; wrap it in an element with its own label to name the group.
 * @tag e-todo
 * @slot - One link for each count.
 */
export declare class ETodo extends HTMLElement {}
