// e-bottom-bar: CSS alone draws it, so this file only declares the tag for the docs and the types. It
// emits no code and src/v2.ts never imports it.
/**
 * A bar of buttons that sticks to the bottom of the page, with the buttons at its end. On a phone each
 * button takes an equal share.
 * @tag e-bottom-bar
 * @attr {boolean} dock - A phone's dock for a record's main actions, such as Call and Confirm; from 600 px it is hidden, as the page header holds them.
 * @slot - The buttons.
 */
export declare class EBottomBar extends HTMLElement {}
