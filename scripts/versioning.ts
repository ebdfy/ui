// Inside a major version nothing an app relies on may go: no element, public property, attribute,
// event or allowed value that the last release of the major had.

interface Member {
  name: string
  kind?: string
  privacy?: string
  static?: boolean
  type?: { text: string }
  description?: string
  default?: string
  attribute?: string
}

interface Declaration {
  name?: string
  tagName?: string
  customElement?: boolean
  description?: string
  attributes?: {
    name: string
    fieldName?: string
    type?: { text: string }
    description?: string
    default?: string
  }[]
  members?: Member[]
  events?: { name: string; description?: string; type?: { text: string } }[]
  slots?: { name: string; description?: string }[]
  cssParts?: { name: string; description?: string }[]
}

export interface Manifest {
  modules: { path: string; declarations?: Declaration[] }[]
}

function elements(manifest: Manifest): Map<string, Declaration> {
  const found = new Map<string, Declaration>()
  for (const module of manifest.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement && declaration.tagName) found.set(declaration.tagName, declaration)
    }
  }
  return found
}

// The string literals of a union type such as "'primary' | 'secondary'".
function allowedValues(type: { text: string } | undefined): string[] {
  return [...(type?.text ?? '').matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? '')
}

function properties(declaration: Declaration): Map<string, Member> {
  const publicFields = (declaration.members ?? []).filter(
    (m) => m.kind === 'field' && !m.static && (m.privacy ?? 'public') === 'public',
  )
  return new Map(publicFields.map((m) => [m.name, m]))
}

export function breakingChanges(baseline: Manifest, current: Manifest): string[] {
  const changes: string[] = []
  const now = elements(current)
  for (const [tag, before] of elements(baseline)) {
    const after = now.get(tag)
    if (!after) {
      changes.push(`${tag} was removed`)
      continue
    }
    const attributes = new Map((after.attributes ?? []).map((a) => [a.name, a]))
    for (const attribute of before.attributes ?? []) {
      const kept = attributes.get(attribute.name)
      if (!kept) changes.push(`${tag}: attribute ${attribute.name} was removed`)
      for (const value of allowedValues(attribute.type)) {
        if (kept && allowedValues(kept.type).length && !allowedValues(kept.type).includes(value)) {
          changes.push(`${tag}: attribute ${attribute.name} no longer allows '${value}'`)
        }
      }
    }
    const props = properties(after)
    for (const name of properties(before).keys()) {
      if (!props.has(name)) changes.push(`${tag}: property ${name} was removed`)
    }
    const events = new Set((after.events ?? []).map((e) => e.name))
    for (const event of before.events ?? []) {
      if (!events.has(event.name)) changes.push(`${tag}: event ${event.name} was removed`)
    }
  }
  return changes
}

// An attribute's type must be primitives and literals, which allowedValues can read. A named alias
// such as `type Variant = 'primary'` reaches the manifest as 'Variant', hiding its values.
const plain = /^('[^']*'|"[^"]*"|string|number|boolean|null|undefined)$/

export function aliasedAttributeTypes(manifest: Manifest): string[] {
  const found: string[] = []
  for (const [tag, declaration] of elements(manifest)) {
    for (const { name, type } of declaration.attributes ?? []) {
      if (type && !type.text.split('|').every((part) => plain.test(part.trim()))) {
        found.push(`${tag}: attribute ${name} has the type '${type.text}'; write its values out`)
      }
    }
  }
  return found
}
