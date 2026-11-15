// e-skeleton. CSS draws it whole and there is no script, so this file only declares the tag for the
// docs and the types. It emits no code and v2.ts never imports it.
/**
 * Grey bars that hold the place of text while it loads. A screen reader finds nothing in it.
 * @tag e-skeleton
 * @attr {'2' | '3' | '4' | '5' | '6' | '7' | '8'} lines - How many lines of body text to draw, the last one shorter; one line when absent. Ignored when shape is set.
 * @attr {'table' | 'details'} shape - Draw a page's real heights instead of text lines: a table's toolbar, head row and 8 rows of 44 px (432 px), or a details page's two cards, 120 px and 200 px with a 16 px gap (336 px).
 */
export declare class ESkeleton extends HTMLElement {}
