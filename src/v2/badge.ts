// e-badge. CSS draws it whole and there is no script, so this file only declares the tag for the docs
// and the types. It emits no code and v2.ts never imports it.
/**
 * An order's status as a small tinted tag. The words carry the status; the colour only repeats it.
 * @tag e-badge
 * @attr {'new' | 'confirmed' | 'courier' | 'delivered' | 'returned'} tone - The status the colour repeats; none for neutral.
 * @slot - The status in words.
 */
export declare class EBadge extends HTMLElement {}
