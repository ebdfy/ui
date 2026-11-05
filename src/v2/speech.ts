// The kit's own words, such as "Next page", follow the page's language. A page switching language
// sets the lang attribute on its root, so one observer of it tells every part that asked.
const heard = new Set<() => void>()
let observer: MutationObserver | undefined

export function onLangChange(said: () => void): () => void {
  observer ??= new MutationObserver(() => {
    for (const one of heard) one()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  heard.add(said)
  return () => heard.delete(said)
}
