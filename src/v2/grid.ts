// e-grid: CSS alone draws it, so this file only declares the tag for the docs and the types. It emits
// no code and src/v2.ts never imports it.
/**
 * Lays its children out in equal columns: one below 600 px, two from 600 px, or more when you ask.
 * @tag e-grid
 * @attr {'3' | '4'} columns - Three or four columns from 600 px; two when absent.
 * @slot - The children, one per cell.
 */
export declare class EGrid extends HTMLElement {}
