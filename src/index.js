/**
 * dsh-board — Node half.
 *
 * Persists the board state (tasks + view selection) for the browser half, which
 * cannot survive an app restart on its own: DSH Desktop binds a fresh random
 * port on every launch, so `localStorage` (origin-scoped) starts empty.
 *
 * Surface: one authenticated HTTP route.
 *   GET  /dsh-board/state  -> { state: <json|null> }
 *   POST /dsh-board/state  -> stores the JSON body atomically
 *
 * The route answers only trusted browser peers (`ctx.connection.requestRejection`),
 * the same check the shipped open-in-app route applies. Payloads are capped and
 * the file is written through a temp file + rename so a crash never leaves a
 * torn JSON document.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Stable plugin row name (matches the client module id). */
export const name = 'dsh-board'

/** Host services this half needs. */
export const inject = ['webServer', 'connection']

/** Route path served to the browser half. */
const STATE_ROUTE = '/dsh-board/state'

/** Maximum accepted request body (tasks are small; this is a safety cap). */
const MAX_BODY_BYTES = 2 * 1024 * 1024

/**
 * Absolute state file path, under the harness home so every profile shares it.
 * @returns the JSON file that holds the board state.
 */
function stateFile() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'dsh-board', 'state.json')
}

/**
 * Previous-good copy of the state file, rewritten on every successful save.
 * @returns the backup path next to the state file.
 */
function backupFile() {
  return `${stateFile()}.bak`
}

/**
 * Read the newest readable copy of the board state.
 * @returns parsed state, or null when neither the file nor its backup is usable.
 */
async function readState() {
  for (const candidate of [stateFile(), backupFile()]) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8'))
    } catch {
      // Missing or torn copy: try the next candidate.
    }
  }
  return null
}

/**
 * Send a JSON response.
 * @param res - response to own.
 * @param status - HTTP status code.
 * @param value - JSON-serializable body.
 */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/**
 * Read a bounded request body.
 * @param req - request whose body to read.
 * @returns UTF-8 text, or undefined when the body exceeds the cap.
 */
async function readBoundedBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Merge an incoming board state into the durable one.
 *
 * Tasks are unioned by id (newer `updatedAt` wins) and tombstones are unioned,
 * so a client posting a stale list can never delete another window's tasks.
 * The view selection is last-writer-wins.
 * @param current - state read from disk, or null on first run.
 * @param incoming - state posted by a browser client.
 * @returns the merged state to persist and serve.
 */
function mergeState(current, incoming) {
  const deleted = Object.assign({}, current?.deleted || {}, incoming?.deleted || {})
  const byId = new Map()
  const currentTasks = Array.isArray(current?.tasks) ? current.tasks : []
  for (const task of currentTasks) {
    if (task !== null && typeof task === 'object' && typeof task.id === 'string') byId.set(task.id, task)
  }
  const incomingTasks = Array.isArray(incoming?.tasks) ? incoming.tasks : []
  for (const task of incomingTasks) {
    if (task === null || typeof task !== 'object' || typeof task.id !== 'string') continue
    const previous = byId.get(task.id)
    if (previous === undefined || (Number(task.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) {
      byId.set(task.id, task)
    }
  }
  const tasks = []
  for (const [id, task] of byId) {
    if (deleted[id] === undefined) tasks.push(task)
  }
  const columns = Array.isArray(incoming?.columns)
    ? incoming.columns
    : (Array.isArray(current?.columns) ? current.columns : null)
  return {
    version: 3,
    tasks,
    deleted,
    columns,
    view: incoming?.view ?? current?.view ?? null,
  }
}

/**
 * Apply the Host half: register the state route and keep its file atomic.
 * @param ctx - Cordis host context with webServer and connection.
 */
export function apply(ctx) {
  const file = stateFile()
  // One writer at a time: read-merge-write must not interleave between two
  // concurrent POSTs or the later write can resurrect a stale snapshot.
  let writeChain = Promise.resolve()

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STATE_ROUTE,
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const state = await readState()
        sendJson(res, 200, { state })
        return
      }

      if (req.method === 'POST') {
        const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
        if (essence !== 'application/json') {
          sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
          return
        }
        const text = await readBoundedBody(req)
        if (text === undefined) {
          sendJson(res, 413, { code: 'payload-too-large', message: 'board state is too large' })
          return
        }
        let parsed
        try { parsed = JSON.parse(text) } catch {
          sendJson(res, 400, { code: 'bad-request', message: 'body is not JSON' })
          return
        }
        if (parsed === null || typeof parsed !== 'object') {
          sendJson(res, 400, { code: 'bad-request', message: 'body must be a JSON object' })
          return
        }
        try {
          const run = writeChain.then(async () => {
            const current = await readState()
            const next = mergeState(current, parsed)
            await mkdir(dirname(file), { recursive: true })
            // Keep the last readable generation before replacing it.
            const previous = await readFile(file, 'utf8').catch(() => null)
            if (previous !== null) await writeFile(backupFile(), previous, 'utf8')
            const temporary = `${file}.${process.pid}.tmp`
            await writeFile(temporary, JSON.stringify(next), 'utf8')
            await rename(temporary, file)
            return next
          })
          writeChain = run.then(() => undefined, () => undefined)
          const merged = await run
          sendJson(res, 200, { ok: true, state: merged })
        } catch (error) {
          ctx.logger?.warn?.(`dsh-board: state write failed: ${String(error)}`)
          sendJson(res, 500, { code: 'state-write-failed', message: 'board state unwritable' })
        }
        return
      }

      res.setHeader('allow', 'GET, HEAD, POST')
      sendJson(res, 405, { code: 'method-not-allowed', message: 'use GET or POST' })
    },
  }), 'dsh-board: state route')
}
