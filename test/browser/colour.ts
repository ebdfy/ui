// Colour checks the browser tests share: contrast between two computed oklch() colours, and a run
// inside the dark theme.

// sRGB from an oklch() string, for contrast: OKLab to linear sRGB, as CSS Color 4 defines it.
function linearRgb(colour: string): [number, number, number] {
  const [l, c, h] = colour.match(/[\d.]+/g)!.map(Number) as [number, number, number]
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number]
}

// The WCAG contrast ratio of two oklch() colours.
export function contrast(one: string, two: string): number {
  const luminance = (colour: string) => {
    const [r, g, b] = linearRgb(colour)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(one), luminance(two)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Runs with the dark theme forced on the root. Copy what you assert out of a computed style before
// it returns: the style is live and goes back to light here.
export async function inDark<T>(run: () => Promise<T>): Promise<T> {
  try {
    document.documentElement.dataset.theme = 'dark'
    return await run()
  } finally {
    delete document.documentElement.dataset.theme
  }
}
