// e-stack: CSS alone draws it, so this file only declares the tag for the docs and the types. It emits
// no code and src/v2.ts never imports it.
/**
 * Lays its children out in a column, or in a row, with an even gap between them.
 * @tag e-stack
 * @attr {'row'} direction - Lays the children out in a row; a column when absent.
 * @attr {'1' | '2' | '3' | '4' | '5' | '6'} gap - The space between children, on the spacing scale. `2` when absent.
 * @attr {'start' | 'center' | 'end' | 'baseline'} align - How children line up across the stack's direction.
 * @attr {boolean} wrap - Lets a row continue on the next line. Only with `direction="row"`.
 * @slot - The children to lay out.
 */
export declare class EStack extends HTMLElement {}
