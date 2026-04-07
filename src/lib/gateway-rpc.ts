/**
 * Lightweight WebSocket RPC client for the OpenClaw gateway.
 *
 * The gateway wire protocol:
 *   send:    { id: string; method: string; params?: unknown }
 *   receive: { id: string; ok: boolean; payload?: unknown; error?: unknown }
 *
 * The client first sends a "connect" request (authenticates) then sends the
 * real RPC method.  Both complete over a single persistent WS connection.
 */

import { WebSocket } from 'ws'
import { getOpenClawConfig } from './openclaw'

type WireRequest = { id: string; method: string; params?: unknown }
type WireResponse = { id: string; ok: boolean; payload?: unknown; error?: unknown }

function nextId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Call one RPC method on the OpenClaw gateway and return the payload.
 * Opens a fresh WS connection, authenticates, calls the method, then closes.
 */
export async function gatewayRpc<T = unknown>(
  method: string,
  params?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  const { baseUrl, token } = getOpenClawConfig()
  if (!token) throw new Error('OPENCLAW_GATEWAY_TOKEN is not set')

  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws'

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        ws.close()
        reject(new Error(`gatewayRpc timeout: ${method}`))
      }
    }, timeoutMs)

    const ws = new WebSocket(wsUrl)

    const pending = new Map<string, (res: WireResponse) => void>()

    const send = (req: WireRequest) => {
      ws.send(JSON.stringify(req))
    }

    const rpc = (m: string, p?: unknown): Promise<WireResponse> => {
      const id = nextId()
      return new Promise<WireResponse>((res) => {
        pending.set(id, res)
        send({ id, method: m, params: p })
      })
    }

    ws.on('error', (err: Error) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    })

    ws.on('message', (data: Buffer | string) => {
      let msg: WireResponse
      try {
        msg = JSON.parse(String(data)) as WireResponse
      } catch {
        return
      }
      const handler = pending.get(msg.id)
      if (handler) {
        pending.delete(msg.id)
        handler(msg)
      }
    })

    ws.on('open', async () => {
      try {
        // 1. authenticate
        const auth = await rpc('connect', {
          token,
          scopes: ['operator.admin', 'operator.read', 'operator.write'],
        })
        if (!auth.ok) {
          throw new Error(`gateway auth failed: ${JSON.stringify(auth.error)}`)
        }

        // 2. call the actual method
        const result = await rpc(method, params)
        ws.close()
        clearTimeout(timer)
        if (!settled) {
          settled = true
          if (result.ok) {
            resolve(result.payload as T)
          } else {
            reject(new Error(`gateway RPC error (${method}): ${JSON.stringify(result.error)}`))
          }
        }
      } catch (err) {
        ws.close()
        clearTimeout(timer)
        if (!settled) {
          settled = true
          reject(err)
        }
      }
    })
  })
}
