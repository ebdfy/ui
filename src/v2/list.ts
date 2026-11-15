// e-list. CSS alone draws it, so this file only declares the tag for the docs and the typings. It
// emits no code and src/v2.ts does not import it.

/**
 * A column of flat rows, one for each child, at any width, split by a 1 px line with no box around each item.
 * @tag e-list
 * @slot - The items, one row each.
 */
export declare class EList extends HTMLElement {}
