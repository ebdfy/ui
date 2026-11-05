// A docs page writes each example once, as <docs-example caption="…">markup</docs-example>. The page
// shows the markup live in a frame, with its caption above and its own code below, printed from the
// same markup, so the code can never drift from the demo.

// The attributes only the docs read, to switch an example's language or find it in a test.
const docsOnly = /^data-(en|bn|taka|phone|state)$|^data-.+-(en|bn)$/
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr'])
// A start tag longer than this, with two or more attributes, puts one attribute on each line.
const width = 80

interface Element {
  kind: 'element'
  tag: string
  attrs: [name: string, value: string | undefined][]
  children: Node[]
  selfClosing: boolean
}
type Node = Element | { kind: 'text'; text: string }

const token =
  /<!--[\s\S]*?-->|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+/g
const attribute = /([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g

function parse(markup: string): Node[] {
  const root: Element = { kind: 'element', tag: '', attrs: [], children: [], selfClosing: false }
  const open: Element[] = [root]
  for (const [text, closing, tag, attrs, slash] of markup.matchAll(token)) {
    const parent = open.at(-1) ?? root
    if (text.startsWith('<!--')) continue
    if (closing) {
      while (open.length > 1 && open.pop()?.tag !== closing);
    } else if (tag) {
      const el: Element = {
        kind: 'element',
        tag,
        attrs: [...(attrs ?? '').matchAll(attribute)]
          .map(([, name = '', value]): [string, string | undefined] => [name, value?.replace(/^["']|["']$/g, '')])
          .filter(([name]) => !docsOnly.test(name)),
        children: [],
        selfClosing: slash === '/',
      }
      parent.children.push(el)
      if (!el.selfClosing && !voidTags.has(tag)) open.push(el)
    } else {
      parent.children.push({ kind: 'text', text })
    }
  }
  return root.children
}

// Printed code as runs of [kind, text]; kind names the syntax colour, '' plain.
type Run = [kind: '' | 'tag' | 'attr' | 'value' | 'punct', text: string]

function valueRuns(value: string | undefined): Run[] {
  if (value === undefined) return []
  return [
    ['punct', '='],
    // A value holding a double quote came in single quotes, and goes out in them.
    ['value', value.includes('"') ? `'${value}'` : `"${value}"`],
  ]
}

function startTag(el: Element, indent: string, inline: boolean): Run[] {
  const attrs = (separator: string): Run[] =>
    el.attrs.flatMap(([name, value]): Run[] => [['', separator], ['attr', name], ...valueRuns(value)])
  const end: Run = ['punct', el.selfClosing ? ' />' : '>']
  const flat: Run[] = [['punct', '<'], ['tag', el.tag], ...attrs(' '), end]
  const length = indent.length + flat.reduce((sum, [, text]) => sum + text.length, 0)
  if (inline || el.attrs.length < 2 || length <= width) return flat
  return [['punct', '<'], ['tag', el.tag], ...attrs(`\n${indent}  `), ['', `\n${indent}`], end]
}

function endTag(el: Element): Run[] {
  return [
    ['punct', '</'],
    ['tag', el.tag],
    ['punct', '>'],
  ]
}

const blank = (node: Node) => node.kind === 'text' && !node.text.trim()

function inlineRuns(node: Node): Run[] {
  if (node.kind === 'text') return [['', node.text.replace(/\s+/g, ' ')]]
  if (node.selfClosing || voidTags.has(node.tag)) return startTag(node, '', true)
  return [...startTag(node, '', true), ...node.children.flatMap(inlineRuns), ...endTag(node)]
}

function blockRuns(node: Node, indent: string): Run[] {
  if (node.kind === 'text') return [['', indent + node.text.trim().replace(/\s+/g, ' ')]]
  const start: Run[] = [['', indent], ...startTag(node, indent, false)]
  if (node.selfClosing || voidTags.has(node.tag)) return start
  const kids = node.children.filter((kid) => !blank(kid))
  // Text among the children is a sentence, which reads on one line, as do a few words alone.
  if (kids.some((kid) => kid.kind === 'text') || kids.length === 0) {
    const inner = kids.flatMap(inlineRuns)
    const first = inner[0]
    if (first?.[0] === '') first[1] = first[1].trimStart()
    const last = inner.at(-1)
    if (last?.[0] === '') last[1] = last[1].trimEnd()
    return [...start, ...inner, ...endTag(node)]
  }
  return [
    ...start,
    ...kids.flatMap((kid): Run[] => [['', '\n'], ...blockRuns(kid, `${indent}  `)]),
    ['', `\n${indent}`],
    ...endTag(node),
  ]
}

function codeRuns(markup: string): Run[] {
  const nodes = parse(markup).filter((node) => !blank(node))
  const newline: Run = ['', '\n']
  return nodes.flatMap((node, i): Run[] => [...(i ? [newline] : []), ...blockRuns(node, '')])
}

// The code an example shows, as plain text: what Copy puts on the clipboard.
export function codeOf(markup: string): string {
  return codeRuns(markup)
    .map(([, text]) => text)
    .join('')
}

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function highlighted(markup: string): string {
  return codeRuns(markup)
    .map(([kind, text]) => (kind ? `<span class="${kind}">${escape(text)}</span>` : escape(text)))
    .join('')
}

const example = /<docs-example((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>([\s\S]*?)<\/docs-example>/g

// Puts each example in its frame: the caption, the live demo, and its code with a Copy button.
export function renderExamples(html: string): string {
  return html.replace(example, (_, attrs: string, markup: string) => {
    const read = (name: string) => new RegExp(`\\s${name}(?:="([^"]*)")?(?=\\s|$)`).exec(attrs)
    const caption = read('caption')?.[1] ?? ''
    const bangla = read('caption-bn')?.[1]
    const words = bangla ? ` data-en="${caption}" data-bn="${bangla}"` : ''
    const layout = read('stack') ? 'demo stack' : 'demo'
    // An example in another language says so, so it takes that language's type and words.
    const lang = read('lang')?.[1]
    return `<figure class="example"${lang ? ` lang="${lang}"` : ''}>
        <figcaption${words}>${caption}</figcaption>
        <div class="frame">
          <div class="${layout}">${markup}</div>
          <div class="code"><pre><code>${highlighted(markup)}</code></pre><button type="button" class="copy">Copy</button></div>
        </div>
      </figure>`
  })
}

// The markup of a page's first example, which the home page's tile for it shows as its preview.
export function firstExample(html: string): string {
  return /<docs-example[^>]*>([\s\S]*?)<\/docs-example>/.exec(html)?.[1] ?? ''
}

// A code block written straight into a page, such as the script tag on the home page, gets the same
// Copy button as an example's code.
export function copyButtons(html: string): string {
  return html.replace(
    /(?<!<div class="code">)<pre>([\s\S]*?)<\/pre>/g,
    '<div class="code alone"><pre>$1</pre><button type="button" class="copy">Copy</button></div>',
  )
}
