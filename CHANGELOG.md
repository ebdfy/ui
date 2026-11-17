# Changelog

## 2.2.0

Every part 2.1 had keeps its tags, attributes and events, so 2.2 reaches each app through the
floating `v2.css` and `v2.js`. An app that must keep 2.1's look loads `v2.1.css` and `v2.1.js`.

### Added for apps, in `v2.css` and `v2.js`

- `e-print-sheet`: an order on one A5 sheet, the invoice above the cut line and the packing slip
  below, as the Admin and any app print it.
- `e-chart`, with `e-chart-step` and `e-chart-bar`: a column chart of a value a day, today's bar in
  lime.
- `e-row total`: a table's totals row.
- `e-rich-text`: a body with bold, italic, lists, links and images, and its HTML to show and edit.
- `e-file-field`: a chosen file's name and size, and a CSV's row count.
- An app's tile, `.e-tile`, holding its icon at 20, 28 and 40 px, or its initial.
- `e-menu-item href`: an item that follows an address as a link does.
- `e-text-field maxlength`.
- The bridge: a title action may say `primary: true`, `ebdfy.config` names the `placement` and
  record `id` a page was opened from, and the page reports its height for its card in an order's
  side column.

### Added in the Admin, in `v2-host.js`

These are the Admin's own parts. An app's page on `v2.js` draws their styles but does not run them.

- `e-arranged-cards`: a page's cards, which staff reorder, remove and add, at 360 px with up and down
  arrows.
- `e-report-builder`, with `e-report-filter` and `e-report-result`: a report from a metric, a
  group-by, filters and a date range, drawn as a chart or a table.
- `e-menu-tree` and `e-menu-tree-item`: a menu's items arranged as a tree of up to 3 levels.
- `e-app-card`: an app's card in an order's side column, framed at the height its page reports.
- An app page's title bar: the app's tile, its title, and up to 2 actions, one of them primary.

### Fixed

- `e-text-area rows` opens as many lines as it says in browsers before Chromium 133.
- In the Admin, a move or a save never loses an edit or lands its answer on another page.

### Changed in 2.1.0, named here

2.1.0 shipped with no notes, and an app on the floating files took two changes it may meet:

- `e-thumbnail size="large"` grew from 56 to 88 px.
- An `e-button-group` with no button marked `pressed` is plain buttons: a click on one chooses
  nothing, so a 2.0 app whose choice starts unset gets no `aria-pressed` and no
  `e-button-group-change` until the app itself marks one `pressed`.
