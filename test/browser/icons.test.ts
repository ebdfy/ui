import { render } from 'lit'
import { expect, test } from 'vitest'

import * as icons from '../../src/icons.ts'

// Ink draws Lucide at 16 and 20 px with a fixed 1.5 px stroke, so the stroke does not scale with
// the icon's size.
for (const [name, icon] of Object.entries(icons)) {
  for (const size of [16, 20]) {
    test(`the ${name} icon at ${size} px draws a 1.5 px stroke`, () => {
      document.body.innerHTML = `<div style="width:${size}px;height:${size}px"></div>`
      const box = document.body.firstElementChild as HTMLElement
      render(icon, box)
      const svg = box.querySelector('svg')!
      svg.style.width = `${size}px`
      svg.style.height = `${size}px`
      const strokes = svg.querySelectorAll('path, rect, circle')
      expect(strokes.length).toBeGreaterThan(0)
      for (const stroke of strokes) {
        const style = getComputedStyle(stroke)
        expect(style.strokeWidth).toBe('1.5px')
        expect(style.vectorEffect).toBe('non-scaling-stroke')
      }
    })
  }
}
