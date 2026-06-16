/**
 * Forum WebSocket Hook
 *
 * Uses a singleton WebSocket manager to prevent multiple connections to the same forum.
 * Connections persist across component remounts and React StrictMode double-renders.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast, useAuthStore } from '@mochi/web'
import { t } from '@lingui/core/macro'
import { forumsKeys } from './use-forums-queries'

interface ForumWebsocketEvent {
  type:
    | 'post/create'
    | 'post/edit'
    | 'post/update'
    | 'post/delete'
    | 'post/lock'
    | 'post/pin'
    | 'post/reject'
    | 'post/remove'
    | 'post/restore'
    | 'comment/create'
    | 'comment/edit'
    | 'comment/update'
    | 'comment/delete'
    | 'comment/remove'
    | 'comment/restore'
    | 'tag/add'
    | 'tag/remove'
  forum: string
  post?: string
  comment?: string
  sender?: string
  /** post/reject: machine-readable reason code from the forum owner */
  reason?: string
  /** post/reject: optional human-readable detail (already localised by the owner side, may be in their language) */
  detail?: string
  /** Present on tag/add (object with id, label, source) and tag/remove (tag ID string) */
  tag?: { id: string; label: string; source: string } | string
}

function rejectMessage(reason: string | undefined, detail: string | undefined): string {
  switch (reason) {
    case 'access_denied':
      return t`You don't have permission to post in this forum`
    case 'restricted':
      return detail || t`You are restricted from posting in this forum`
    case 'rate_limited':
      return detail || t`You are posting too quickly — please wait and try again`
    case 'invalid':
      return t`Post couldn't be saved — title or body is invalid`
    case 'duplicate':
      return t`This post was already submitted`
    case 'forum_not_found':
      return t`Forum is no longer available`
    case 'server_error':
    default:
      return t`Post couldn't be saved on the forum server`
  }
}

const RECONNECT_DELAY = 3000

function getWebSocketUrl(key: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const raw = useAuthStore.getState().token
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
  return `${protocol}//${window.location.host}/_/websocket?key=${key}${tokenParam}`
}

/**
 * Singleton WebSocket Manager
 * Manages WebSocket connections by key, preventing duplicate connections
 */
class WebSocketManager {
  private connections = new Map<string, WebSocket>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private subscribers = new Map<
    string,
    Set<(event: ForumWebsocketEvent) => void>
  >()
  private connectionAttempts = new Map<string, boolean>()

  subscribe(
    key: string,
    callback: (event: ForumWebsocketEvent) => void
  ): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    this.subscribers.get(key)!.add(callback)
    this.ensureConnection(key)
    return () => {
      const subs = this.subscribers.get(key)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(key)
          this.closeConnection(key)
        }
      }
    }
  }

  private ensureConnection(key: string) {
    const existing = this.connections.get(key)
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    if (this.connectionAttempts.get(key)) return
    this.connect(key)
  }

  private connect(key: string) {
    const timer = this.reconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(key)
    }
    if (
      !this.subscribers.has(key) ||
      this.subscribers.get(key)!.size === 0
    ) {
      return
    }

    this.connectionAttempts.set(key, true)
    try {
      const ws = new WebSocket(getWebSocketUrl(key))
      this.connections.set(key, ws)

      ws.onopen = () => {
        this.connectionAttempts.set(key, false)
      }

      ws.onmessage = (event) => {
        try {
          const data: ForumWebsocketEvent = JSON.parse(event.data as string)
          this.subscribers.get(key)?.forEach((cb) => cb(data))
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        this.connectionAttempts.set(key, false)
        this.connections.delete(key)
        if (
          this.subscribers.has(key) &&
          this.subscribers.get(key)!.size > 0
        ) {
          const reconnectTimer = setTimeout(
            () => this.connect(key),
            RECONNECT_DELAY
          )
          this.reconnectTimers.set(key, reconnectTimer)
        }
      }

      ws.onerror = () => {
        this.connectionAttempts.set(key, false)
      }
    } catch {
      this.connectionAttempts.set(key, false)
      if (
        this.subscribers.has(key) &&
        this.subscribers.get(key)!.size > 0
      ) {
        const reconnectTimer = setTimeout(
          () => this.connect(key),
          RECONNECT_DELAY
        )
        this.reconnectTimers.set(key, reconnectTimer)
      }
    }
  }

  private closeConnection(key: string) {
    const timer = this.reconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(key)
    }
    const ws = this.connections.get(key)
    if (ws) {
      ws.close()
      this.connections.delete(key)
    }
    this.connectionAttempts.delete(key)
  }
}

// Singleton instance
const wsManager = new WebSocketManager()

/**
 * Hook to subscribe to forum WebSocket events.
 * Uses a singleton manager to prevent duplicate connections.
 *
 * @param forumKey - The forum fingerprint to subscribe to
 * @param userId - Current user ID, used to filter out self-events
 * @param onNewPost - When provided, incoming `post/create` events are routed
 *   here (with the new post id) instead of auto-invalidating the posts list,
 *   so the caller can queue them behind a "new posts available" pill.
 */
export function useForumWebsocket(
  forumKey?: string,
  userId?: string,
  onNewPost?: (postId?: string) => void
) {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((state) => state.isInitialized)
  const authToken = useAuthStore((state) => state.token)

  // Use ref for userId so it doesn't cause reconnections
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // Ref so a changing callback doesn't tear down the WebSocket subscription
  const onNewPostRef = useRef(onNewPost)
  onNewPostRef.current = onNewPost

  useEffect(() => {
    if (!authReady) return
    if (!forumKey) return

    const handleMessage = (data: ForumWebsocketEvent) => {
      // Skip events from the current user (optimistic UI already applied)
      if (userIdRef.current && data.sender === userIdRef.current) return

      const forumId = data.forum

      // A brand-new top-level post: queue it behind the "new posts available"
      // pill instead of injecting it into the list under the reader. Other post
      // events (edit/delete/lock/pin/...) still flow through to live-update
      // already-visible rows.
      if (data.type === 'post/create' && onNewPostRef.current) {
        onNewPostRef.current(data.post)
        return
      }

      switch (data.type) {
        case 'post/create':
        case 'post/edit':
        case 'post/update':
        case 'post/delete':
        case 'post/lock':
        case 'post/pin':
        case 'post/remove':
        case 'post/restore':
        case 'tag/add':
        case 'tag/remove':
          void queryClient.invalidateQueries({
            queryKey: ['forum-posts'],
            predicate: (query) => {
              const key = query.queryKey
              if (key[0] !== 'forum-posts') return false
              const queryForumId = key[1] as string | undefined
              if (!queryForumId) return false
              return queryForumId === forumKey || queryForumId === forumId
            },
          })
          if (data.post) {
            void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, data.post) })
            if (forumKey && forumKey !== forumId) {
              void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumKey, data.post) })
            }
          }
          break
        case 'comment/create':
        case 'comment/edit':
        case 'comment/update':
        case 'comment/delete':
        case 'comment/remove':
        case 'comment/restore':
          if (data.post) {
            void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, data.post) })
            if (forumKey && forumKey !== forumId) {
              void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumKey, data.post) })
            }
          }
          break
        case 'post/reject':
          // The forum owner refused the post; the Starlark handler has already
          // deleted the optimistic pending row. Surface the reason and refresh
          // the post list so the row disappears from the UI.
          toast.error(rejectMessage(data.reason, data.detail))
          void queryClient.invalidateQueries({
            queryKey: ['forum-posts'],
            predicate: (query) => {
              const key = query.queryKey
              if (key[0] !== 'forum-posts') return false
              const queryForumId = key[1] as string | undefined
              if (!queryForumId) return false
              return queryForumId === forumKey || queryForumId === forumId
            },
          })
          break
      }
    }

    const unsubscribe = wsManager.subscribe(forumKey, handleMessage)
    return unsubscribe
  }, [authReady, authToken, forumKey, queryClient]) // Note: userId NOT in deps - uses ref instead
}
