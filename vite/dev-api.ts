import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { AwsClient } from 'aws4fetch'
import { loadEnv, type Plugin } from 'vite'
import { MAX_UPLOAD_BYTES } from '../shared/constants.ts'
import { bearerToken, fetchAuthedUser, userIsProjectAdmin } from '../shared/admin.ts'
import { fetchProductHero } from '../shared/fetchProductImage.ts'
import {
  assertPngCanBeTransparent,
  objectKey,
  parsePng,
  pngHasSeeThroughPixel,
} from '../shared/png.ts'

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] ?? 0)
  if (declared > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('PNG is too large (max 10MB).'), { status: 413 })
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_UPLOAD_BYTES) {
      throw Object.assign(new Error('PNG is too large (max 10MB).'), { status: 413 })
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

async function requireAdmin(req: IncomingMessage, env: Record<string, string>) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const anonKey =
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return
  const token = bearerToken(
    typeof req.headers.authorization === 'string' ? req.headers.authorization : null,
  )
  if (!token) {
    throw Object.assign(new Error('Sign in required.'), { status: 401 })
  }
  const user = await fetchAuthedUser(supabaseUrl, anonKey, token)
  const allowed = await userIsProjectAdmin(supabaseUrl, anonKey, token, user)
  if (!allowed) {
    throw Object.assign(new Error('Admin role required.'), { status: 403 })
  }
}

async function putR2(
  env: Record<string, string>,
  key: string,
  bytes: Buffer,
): Promise<boolean> {
  const accountId = env.R2_ACCOUNT_ID
  const accessKey = env.R2_ACCESS_KEY_ID
  const secret = env.R2_SECRET_ACCESS_KEY
  const bucket = env.R2_BUCKET_NAME || 'knoll-items'
  if (!accountId || !accessKey || !secret) return false

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secret,
  })
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`
  const response = await client.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: bytes,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`R2 upload failed (${response.status}): ${text.slice(0, 200)}`)
  }
  return true
}

export function knollDevApi(): Plugin {
  return {
    name: 'knoll-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')

      server.middlewares.use('/api/product-image', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }

        void (async () => {
          try {
            await requireAdmin(req, env)
            const raw = await readBody(req)
            const payload = JSON.parse(raw.toString('utf8')) as { url?: unknown }
            const url = typeof payload.url === 'string' ? payload.url.trim() : ''
            if (!url) {
              json(res, 400, { error: 'Paste a product URL.' })
              return
            }
            const hero = await fetchProductHero(url)
            res.statusCode = 200
            res.setHeader('Content-Type', hero.contentType)
            res.setHeader('Cache-Control', 'no-store')
            if (hero.title) {
              res.setHeader('X-Product-Title', encodeURIComponent(hero.title))
            }
            res.end(Buffer.from(hero.bytes))
          } catch (err) {
            const status = (err as { status?: number }).status ?? 400
            const message =
              err instanceof Error ? err.message : 'Could not fetch a product image.'
            json(res, status, { error: message })
          }
        })()
      })

      server.middlewares.use('/api/upload', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }

        void (async () => {
          try {
            await requireAdmin(req, env)
            const buffer = await readBody(req)
            const bytes = new Uint8Array(buffer)
            const info = parsePng(bytes)
            assertPngCanBeTransparent(info)
            if (!(await pngHasSeeThroughPixel(bytes))) {
              json(res, 400, {
                error:
                  'This PNG has an alpha channel but no transparent pixels. Export it on a transparent background.',
              })
              return
            }
            const key = objectKey()
            const uploaded = await putR2(env, key, buffer)
            if (uploaded) {
              json(res, 200, { path: key, width: info.width, height: info.height })
              return
            }
            const dir = path.resolve(process.cwd(), 'public/dev-uploads')
            await fs.mkdir(dir, { recursive: true })
            const filename = `${crypto.randomUUID()}.png`
            await fs.writeFile(path.join(dir, filename), buffer)
            json(res, 200, {
              path: `dev-uploads/${filename}`,
              width: info.width,
              height: info.height,
            })
          } catch (err) {
            const status = (err as { status?: number }).status ?? 400
            const message = err instanceof Error ? err.message : 'Upload failed.'
            json(res, status, { error: message })
          }
        })()
      })
    },
  }
}
