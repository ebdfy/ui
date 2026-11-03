// Imported by v1.ts and host.ts before either defines an element. Below the floor (Chrome 111),
// the page's body becomes an update notice before any element is defined, so none upgrades. The test is a feature test,
// declarative shadow DOM, which shipped in Chrome 111; the user agent is never read.
// `?floor=old` fails the test on purpose, for the playground and for tests.
const old =
  !('shadowRootMode' in HTMLTemplateElement.prototype) || new URLSearchParams(location.search).get('floor') === 'old'

if (old) {
  const bangla = document.documentElement.lang.startsWith('bn')
  const copy = bangla
    ? {
        heading: 'ebdfy ব্যবহার করতে ব্রাউজার আপডেট করুন',
        line: 'এই ব্রাউজারটি ebdfy চালানোর জন্য অনেক পুরনো।',
        link: 'Google Play থেকে Chrome নিন',
      }
    : {
        heading: 'Update your browser to use ebdfy',
        line: 'This browser is too old for ebdfy.',
        link: 'Get Chrome on Google Play',
      }

  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1'
    document.head.append(viewport)
  }

  // Inline styles, because the design tokens may not be installed on this page.
  const page = document.createElement('main')
  page.style.cssText =
    'box-sizing:border-box;max-width:32rem;margin:0 auto;padding:32px 16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;background:#fff;line-height:1.5'
  const heading = document.createElement('h1')
  heading.style.cssText = 'margin:0 0 12px;font-size:1.5rem;line-height:1.3'
  heading.textContent = copy.heading
  const line = document.createElement('p')
  line.style.cssText = 'margin:0 0 24px'
  line.textContent = copy.line
  const link = document.createElement('a')
  link.href = 'https://play.google.com/store/apps/details?id=com.android.chrome'
  link.style.cssText =
    'box-sizing:border-box;display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:8px;background:#2340b8;color:#fff;font-weight:600;text-decoration:none'
  link.textContent = copy.link
  page.append(heading, line, link)

  document.body.style.background = '#fff'
  document.body.replaceChildren(page)
}
