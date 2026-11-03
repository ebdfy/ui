import { afterEach, expect, test, vi } from 'vitest'

import { verifyIdToken, type IdTokenClaims, type Jwks } from '../../src/playground-api.ts'
import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const frame = () => chrome().shadowRoot!.querySelector('iframe')!
const barText = () => chrome().shadowRoot!.querySelector('[part="title"]')?.textContent ?? ''

async function open(): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome
    src="${appOrigin}/test/browser/fixtures/token.html?store=demo"
    token-url="/dev/id-token?app=sample"
    api-url="${appOrigin}/dev/graphql"
  ></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(barText, { timeout: 10_000 }).toBe('Token')
}

interface Told {
  token?: string
  result?: { data?: { shop?: { name: string } }; errors?: { extensions: { code: string } }[] }
  error?: string
}

// Has the app call ebdfy.idToken() or ebdfy.fetch(query) and resolves with what it got.
function ask(what: string): Promise<Told> {
  const told = new Promise<Told>((resolve) => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame().contentWindow || event.data?.type !== 'fixture') return
      window.removeEventListener('message', listen)
      resolve(event.data)
    }
    window.addEventListener('message', listen)
  })
  frame().contentWindow!.postMessage({ ask: what }, appOrigin)
  return told
}

const claimsOf = (token: string): IdTokenClaims =>
  JSON.parse(atob(token.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/')))
const jwks = async (): Promise<Jwks> => (await fetch('/dev/jwks.json')).json()

afterEach(() => {
  vi.useRealTimers()
})

test('ebdfy.idToken() returns a 1-minute JWT naming the store, the installation and the staff member', async () => {
  await open()
  const { token } = await ask('token')
  const claims = claimsOf(token!)
  expect(claims.exp - claims.iat).toBe(60)
  expect(claims).toMatchObject({ store: 'demo', installation: 'inst_sample', staff: 'stf_demo', aud: 'app_sample' })
})

test('the token verifies against the JWKS, and not once a byte of its signature changes', async () => {
  await open()
  const { token } = await ask('token')
  const keys = await jwks()
  await expect(verifyIdToken(token!, keys, { audience: 'app_sample' })).resolves.toMatchObject({ store: 'demo' })
  const [header, payload, signature] = token!.split('.')
  const flipped = `${signature![0] === 'A' ? 'B' : 'A'}${signature!.slice(1)}`
  await expect(verifyIdToken(`${header}.${payload}.${flipped}`, keys, { audience: 'app_sample' })).rejects.toThrow(
    'signature',
  )
})

test("a token for the sample app fails a second app's verifier on aud", async () => {
  await open()
  const { token } = await ask('token')
  await expect(verifyIdToken(token!, await jwks(), { audience: 'app_other' })).rejects.toThrow('aud')
})

test('ebdfy.fetch reads the store name through the fake Admin API', async () => {
  await open()
  const { result } = await ask('{ shop { name } }')
  expect(result).toEqual({ data: { shop: { name: 'Demo Shop' } } })
})

test('a staff member without write_orders cannot cancel an order through an app that has it', async () => {
  await open()
  const { result } = await ask('mutation { orderCancel(id: "ord_1") { userErrors { message } } }')
  expect(result!.errors![0]!.extensions.code).toBe('ACCESS_DENIED')
})

test('two calls 30 s apart get one token, and a call at 61 s gets a new one', async () => {
  await open()
  vi.useFakeTimers({ toFake: ['Date'] })
  const start = Date.now()
  const first = (await ask('token')).token
  vi.setSystemTime(start + 30_000)
  expect((await ask('token')).token).toBe(first)
  // Within 10 s of its end a token is not handed out, so a call has time to use it.
  vi.setSystemTime(start + 51_000)
  const fresh = (await ask('token')).token
  expect(claimsOf(fresh!).jti).not.toBe(claimsOf(first!).jti)
  vi.setSystemTime(start + 61_000)
  const later = (await ask('token')).token
  expect(claimsOf(later!).jti).not.toBe(claimsOf(first!).jti)
})
