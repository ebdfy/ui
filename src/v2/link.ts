// e-link: CSS alone draws it, so this file only declares the tag for the docs and the types. It emits
// no code and src/v2.ts never imports it.
/**
 * A link in a sentence. Write an `<a>` inside it and the tag styles that link, so it works with no script.
 * @tag e-link
 * @slot - An `<a href>` with the link's words.
 */
export declare class ELink extends HTMLElement {}
