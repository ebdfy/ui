// e-badge. CSS draws it whole and there is no script, so this file only declares the tag for the docs
// and the types. It emits no code and v2.ts never imports it.
/**
 * A status as a small tinted tag. The words carry the status; the colour only repeats it.
 * @tag e-badge
 * @attr {'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'new' | 'confirmed' | 'courier' | 'delivered' | 'returned'} tone - The meaning the colour repeats; none for neutral. The last five are order statuses.
 * @attr {boolean} dot - Draws a round dot in the tone's colour before the words.
 * @slot - The status in words.
 */
export declare class EBadge extends HTMLElement {}
