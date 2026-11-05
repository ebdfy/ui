// e-thumbnail. CSS alone draws it, so this file only declares the tag for the docs and the typings.
// It emits no code and src/v2.ts does not import it.

/**
 * A fixed square for a product or item picture, 40 px by default. Put an `img` inside; its own `src`
 * and `alt` are read. With no image the square is an empty tint.
 * @tag e-thumbnail
 * @attr {'small' | 'large'} size - 32 px for small, 56 px for large. Without it the square is 40 px.
 * @slot - The `img`.
 */
export declare class EThumbnail extends HTMLElement {}
