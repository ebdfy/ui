import { afterAll, expect, test } from 'vitest'

import { createPlaygroundApi, type Jwks, verifyIdToken } from '../../src/playground-api.ts'
import { startPages } from './pages.ts'

const origin = 'http://localhost:5173'

// The clock the API reads, which a test moves forward to expire a token.
let now = Date.UTC(2026, 10, 2, 9, 0, 0)
const api = createPlaygroundApi(undefined, () => now)

async function call(path: string, init: RequestInit = {}) {
  const response = await api(new Request(`${origin}${path}`, init))
  if (!response) throw new Error(`${path} was not answered`)
  return response
}

async function mint(): Promise<string> {
  const response = await call('/dev/id-token?app=sample', { method: 'POST' })
  expect(response.status).toBe(200)
  return ((await response.json()) as { token: string }).token
}

async function jwks() {
  return (await (await call('/dev/jwks.json')).json()) as Jwks
}

function claims(token: string) {
  const payload = token.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/')
  return JSON.parse(atob(payload)) as Record<string, unknown>
}

function graphql(query: string, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return call('/dev/graphql', { method: 'POST', headers, body: JSON.stringify({ query, variables: {} }) })
}

const cancel = 'mutation { orderCancel(id: "ord_1") { userErrors { message } } }'

test('a minted token names the demo store, the sample installation and the demo staff member for a minute', async () => {
  const token = await mint()
  const [header] = token.split('.')
  expect(JSON.parse(atob(header!.replaceAll('-', '+').replaceAll('_', '/')))).toMatchObject({
    alg: 'ES256',
    typ: 'JWT',
  })
  const body = claims(token)
  expect(body).toMatchObject({
    iss: origin,
    aud: 'app_sample',
    store: 'demo',
    installation: 'inst_sample',
    staff: 'stf_demo',
    iat: 1793610000,
    exp: 1793610060,
  })
  expect(body.jti).toEqual(expect.any(String))
  expect(await mint()).not.toBe(token)
})

test('the token verifies against the served keys until one byte of its signature changes', async () => {
  const token = await mint()
  const keys = await jwks()
  expect((await verifyIdToken(token, keys, { audience: 'app_sample', now })).staff).toBe('stf_demo')

  const [header, payload, signature] = token.split('.') as [string, string, string]
  const changed = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
  await expect(verifyIdToken(changed, keys, { audience: 'app_sample', now })).rejects.toThrow(/signature/)
})

test("another app's verifier refuses the token for its aud", async () => {
  await expect(verifyIdToken(await mint(), await jwks(), { audience: 'app_other', now })).rejects.toThrow(/aud/)
})

test('the JWKS publishes only the public half of the key', async () => {
  const [key] = (await jwks()).keys
  expect(key).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' })
  expect(key).not.toHaveProperty('d')
})

test('a staff member whose access ended gets no token, and an unknown app gets a 404', async () => {
  const ended = await call('/dev/id-token?app=sample&ended', { method: 'POST' })
  expect(ended.status).toBe(403)
  expect(await ended.json()).toEqual({ error: 'ACCESS_ENDED' })
  expect((await call('/dev/id-token?app=other', { method: 'POST' })).status).toBe(404)
})

test('the fake Admin API answers the shop name to a token holder', async () => {
  const response = await graphql('{ shop { name } }', await mint())
  expect(response.status).toBe(200)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(await response.json()).toEqual({ data: { shop: { name: 'Demo Shop' } } })
})

test('orderCancel is denied, since the demo staff member lacks write_orders', async () => {
  const response = await graphql(cancel, await mint())
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({
    errors: [{ message: 'This request needs the write_orders scope.', extensions: { code: 'ACCESS_DENIED' } }],
  })
})

test('a request without a token, or with an expired one, is unauthenticated', async () => {
  const missing = await graphql('{ shop { name } }')
  expect(missing.status).toBe(401)
  expect(missing.headers.get('access-control-allow-origin')).toBe('*')
  expect(await missing.json()).toMatchObject({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] })

  const token = await mint()
  now += 61_000
  const expired = await graphql('{ shop { name } }', token)
  expect(expired.status).toBe(401)
  expect(await expired.json()).toMatchObject({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] })
})

test('the fake Admin API answers a cross-origin preflight', async () => {
  const response = await call('/dev/graphql', { method: 'OPTIONS' })
  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(response.headers.get('access-control-allow-methods')).toBe('POST')
  expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type')
})

test('other paths are left to the next handler', async () => {
  expect(await api(new Request(`${origin}/playground`))).toBeNull()
})

let pages: Awaited<ReturnType<typeof startPages>> | undefined
afterAll(() => pages?.close())

test('the local dev server serves the keys on the playground origin', async () => {
  pages = await startPages()
  const served = (await (await fetch(`${pages.ui}/dev/jwks.json`)).json()) as Jwks
  expect(served.keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256' })
})
