// e-person: CSS alone draws it, so this file only declares the tag for the docs and the typings. It
// emits no code and src/v2.ts does not import it.

/**
 * A person in one row: an `e-avatar`, the name, and one line of their history under it.
 * @tag e-person
 * @slot - The `e-avatar`, then the name, such as a link to the person.
 * @slot meta - One line of history, such as "4 orders · ৳9,840 spent".
 */
export declare class EPerson extends HTMLElement {}
