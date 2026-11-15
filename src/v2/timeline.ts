// e-timeline, e-timeline-day and e-timeline-item: CSS alone draws them, so this file only declares
// the tags for the docs and the typings. It emits no code and src/v2.ts does not import it.

/**
 * What happened to a record, newest first, on a rail. A form with `slot="composer"` sits at the top in
 * one row: the writer's `e-avatar`, an `e-text-field` and its `e-button`. Posting is the app's action;
 * the form is no save-bar form.
 * @tag e-timeline
 * @slot - `e-timeline-day` labels and `e-timeline-item` steps, newest first.
 * @slot composer - A form to add a comment.
 */
export declare class ETimeline extends HTMLElement {}

/**
 * A day label, such as "Today", above that day's steps.
 * @tag e-timeline-day
 * @slot - The day.
 */
export declare class ETimelineDay extends HTMLElement {}

/**
 * One step on the rail: who did it, what they did and when, on one line.
 * @tag e-timeline-item
 * @attr {'comment'} kind - A staff comment: its `slot="body"` is a block under the actor.
 * @slot - The action, as text after the actor.
 * @slot actor - Who did it, such as a `strong`.
 * @slot time - When, such as a `time` reading "11:24 AM".
 * @slot body - A comment's words.
 */
export declare class ETimelineItem extends HTMLElement {}
