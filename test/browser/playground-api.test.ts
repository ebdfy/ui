import { expect, test } from 'vitest'

// The test page is on 127.0.0.1, so the API on localhost answers it across origins, as the fake
// Admin API answers the sample app.
const apiOrigin = `http://localhost:${location.port}`

test('the test server serves the playground keys and mints a token the fake Admin API accepts', async () => {
  const { keys } = (await (await fetch('/dev/jwks.json')).json()) as { keys: JsonWebKey[] }
  expect(keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256' })

  const { token } = (await (await fetch('/dev/id-token?app=sample', { method: 'POST' })).json()) as { token: string }
  const response = await fetch(`${apiOrigin}/dev/graphql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ shop { name } }', variables: {} }),
  })
  expect(await response.json()).toEqual({ data: { shop: { name: 'Demo Shop' } } })
})
