// Inside the Admin, a plain fetch() to the app's own origin carries the staff member's ID token and
// language, so the app's backend knows who asks. Other origins are never signed: the token names a
// store and a staff member, and only the app's own server should hear it.
import { parentOrigin } from '../bridge.ts'

export function signFetch(
  win: Window,
  { idToken, user }: { idToken: () => Promise<string>; user: () => Promise<{ language: string }> },
): void {
  if (!parentOrigin(win)) return
  const original = win.fetch.bind(win)
  win.fetch = async (input, init) => {
    // The caller's arguments are read once, into the one Request that is checked and sent, so an
    // address cannot read as the app's own for the check and as another origin for the fetch. Its
    // body moves into that Request, which goes on to other origins as it came.
    const request = new Request(input, init)
    if (new URL(request.url).origin !== win.location.origin) return original(request)
    const [token, { language }] = await Promise.all([idToken(), user()])
    if (!request.headers.has('authorization')) request.headers.set('authorization', `Bearer ${token}`)
    if (!request.headers.has('accept-language')) request.headers.set('accept-language', language)
    return original(request)
  }
}
