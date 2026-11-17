// An app's tile shows its icon over its initial. An icon that fails to load is hidden, so the initial
// shows: one that failed before this script ran is found by decode(), one that fails later by its
// error event, which does not bubble, so the document hears it as it passes down.
const drop = (image: EventTarget | null) => {
  if (image instanceof HTMLImageElement && image.parentElement?.classList.contains('e-tile')) image.hidden = true
}

export function keepTileInitials(root: Document = document): void {
  root.addEventListener('error', (event) => drop(event.target), true)
  for (const image of root.querySelectorAll<HTMLImageElement>('.e-tile > img')) {
    image.decode().catch(() => drop(image))
  }
}
