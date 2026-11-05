// A file under src/ or site/ that changes while the suite runs makes the dev servers reload pages
// under running tests, which then fail for no fault of their own ("Execution context was
// destroyed"; lessons ui m8, m21). So the run notes every file there as it starts, and fails at its
// end if any changed: a red beside that message is the edit's, not the code's.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function snapshotTree(roots: string[]): Map<string, number> {
  const files = new Map<string, number>()
  for (const root of roots) {
    for (const name of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
      const path = join(root, name)
      const stat = statSync(path, { throwIfNoEntry: false })
      if (stat?.isFile()) files.set(path, stat.mtimeMs)
    }
  }
  return files
}

// Each file added, removed or written since the snapshot.
export function changedSince(before: Map<string, number>, roots: string[]): string[] {
  const after = snapshotTree(roots)
  const changed = [...after].filter(([path, time]) => before.get(path) !== time).map(([path]) => path)
  const removed = [...before.keys()].filter((path) => !after.has(path))
  return [...changed, ...removed].toSorted()
}

const roots = ['../../src', '../../site'].map((folder) => fileURLToPath(new URL(folder, import.meta.url)))

export default function setup() {
  const before = snapshotTree(roots)
  return () => {
    const changed = changedSince(before, roots)
    if (!changed.length) return
    // Vitest only logs an error thrown here, and the run would still pass, so it sets the exit code.
    console.error(
      `These files changed while the suite ran, so its reds may be page reloads, not faults; run it again untouched:\n${changed.join('\n')}`,
    )
    process.exitCode = 1
  }
}
