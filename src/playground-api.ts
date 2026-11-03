// The playground's stand-in for the Admin API until the real one mints ID tokens: it signs ES256
// ID tokens for the sample app, publishes their key as a JWKS, and answers two GraphQL operations
// for a bearer of such a token. It uses only WebCrypto, so the Worker and the Node servers share it.

export interface IdTokenClaims {
  iss: string
  aud: string
  store: string
  installation: string
  staff: string
  iat: number
  exp: number
  jti: string
}

interface JwtHeader {
  alg: string
  typ: string
  kid: string
}

export interface PublicJwk extends JsonWebKey {
  kid: string
}

export interface Jwks {
  keys: PublicJwk[]
}

// One app installed on one store, used by one staff member. A token grants the scopes both hold.
const app = { handle: 'sample', clientId: 'app_sample', installation: 'inst_sample' }
const installationScopes = ['read_orders', 'write_orders']
const staff = { id: 'stf_demo', scopes: ['read_orders'] }
const store = { handle: 'demo', name: 'Demo Shop' }
const granted = new Set(installationScopes.filter((scope) => staff.scopes.includes(scope)))

const ecdsa = { name: 'ECDSA', namedCurve: 'P-256' }
const sha256 = { name: 'ECDSA', hash: 'SHA-256' }
const text = new TextEncoder()

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function decode(segment: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(segment.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
}

const encodeJson = (part: JwtHeader | IdTokenClaims) => encode(text.encode(JSON.stringify(part)))
const decodeJson = (segment: string) => JSON.parse(new TextDecoder().decode(decode(segment)))

// The kid is the key's RFC 7638 thumbprint, so every Worker isolate holding one key names it alike.
async function thumbprint({ crv, x, y }: JsonWebKey): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', text.encode(JSON.stringify({ crv, kty: 'EC', x, y })))
  return encode(new Uint8Array(digest))
}

async function signer(key?: JsonWebKey) {
  let privateJwk = key
  if (!privateJwk) {
    // SAFETY: an ECDSA key is asymmetric, so generateKey makes a pair, and 'jwk' exports a JWK.
    const pair = (await crypto.subtle.generateKey(ecdsa, true, ['sign', 'verify'])) as CryptoKeyPair
    // SAFETY: as above, the 'jwk' format exports a JsonWebKey rather than raw bytes.
    privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
  }
  const { crv, x, y, d } = privateJwk
  const privateKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv, x, y, d }, ecdsa, false, ['sign'])
  const kid = await thumbprint(privateJwk)
  const jwks: Jwks = { keys: [{ kty: 'EC', crv, x, y, kid, alg: 'ES256', use: 'sig' }] }
  const sign = async (claims: IdTokenClaims) => {
    const input = `${encodeJson({ alg: 'ES256', typ: 'JWT', kid })}.${encodeJson(claims)}`
    const signature = await crypto.subtle.sign(sha256, privateKey, text.encode(input))
    return `${input}.${encode(new Uint8Array(signature))}`
  }
  return { jwks, sign }
}

// Checks a token as an app's backend would, and names the check that failed.
export async function verifyIdToken(
  token: string,
  jwks: Jwks,
  { audience, now = Date.now() }: { audience: string; now?: number },
): Promise<IdTokenClaims> {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) throw new Error('The token is not a JWT.')
  // SAFETY: the header is unsigned so far, and the next lines check both fields read from it.
  const { kid, alg } = decodeJson(header) as Partial<JwtHeader>
  const jwk = jwks.keys.find((key) => key.kid === kid)
  if (alg !== 'ES256' || !jwk) throw new Error(`No ES256 key in the JWKS has kid ${kid}.`)
  const { crv, x, y } = jwk
  const publicKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv, x, y }, ecdsa, false, ['verify'])
  const signed = text.encode(`${header}.${payload}`)
  if (!(await crypto.subtle.verify(sha256, publicKey, decode(signature), signed))) {
    throw new Error('The token signature does not verify.')
  }
  // SAFETY: the signature above proves the key's holder wrote these claims, and it writes them whole.
  const claims = decodeJson(payload) as IdTokenClaims
  if (claims.aud !== audience) throw new Error(`The token aud is ${claims.aud}, not ${audience}.`)
  if (claims.exp <= now / 1000) throw new Error(`The token exp ${claims.exp} has passed.`)
  return claims
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST',
  'access-control-allow-headers': 'authorization, content-type',
}

const graphqlError = (status: number, code: string, message: string) =>
  Response.json({ errors: [{ message, extensions: { code } }] }, { status, headers: cors })

// Without a key it makes one, so a dev or test server's JWKS and minter agree for its lifetime.
export function createPlaygroundApi(key?: JsonWebKey, clock: () => number = Date.now) {
  let keys: ReturnType<typeof signer> | undefined

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    const { jwks, sign } = await (keys ??= signer(key))

    if (url.pathname === '/dev/jwks.json') return Response.json(jwks)

    if (url.pathname === '/dev/id-token') {
      if (url.searchParams.get('app') !== app.handle) return new Response('No such app', { status: 404 })
      if (url.searchParams.has('ended')) return Response.json({ error: 'ACCESS_ENDED' }, { status: 403 })
      const iat = Math.floor(clock() / 1000)
      const token = await sign({
        iss: url.origin,
        aud: app.clientId,
        store: store.handle,
        installation: app.installation,
        staff: staff.id,
        iat,
        exp: iat + 60,
        jti: crypto.randomUUID(),
      })
      return Response.json({ token })
    }

    if (url.pathname === '/dev/graphql') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
      const bearer = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
      try {
        if (!bearer) throw new Error('The request has no bearer token.')
        await verifyIdToken(bearer, jwks, { audience: app.clientId, now: clock() })
      } catch (error) {
        return graphqlError(401, 'UNAUTHENTICATED', error instanceof Error ? error.message : String(error))
      }
      // SAFETY: the playground and its tests send a GraphQL body, whose query is a string.
      const { query } = (await request.json()) as { query: string }
      if (query.includes('orderCancel')) {
        if (!granted.has('write_orders')) {
          return graphqlError(403, 'ACCESS_DENIED', 'This request needs the write_orders scope.')
        }
        return Response.json({ data: { orderCancel: { userErrors: [] } } }, { headers: cors })
      }
      if (query.includes('shop') && query.includes('name')) {
        return Response.json({ data: { shop: { name: store.name } } }, { headers: cors })
      }
      return graphqlError(400, 'BAD_REQUEST', 'The playground API answers only shop name and orderCancel.')
    }

    return null
  }
}
