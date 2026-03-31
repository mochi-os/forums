/**
 * Forum WebSocket Hook
 *
 * Uses a singleton WebSocket manager to prevent multiple connections to the same forum.
 * Connections persist across component remounts and React StrictMode double-renders.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isInShell } from '@mochi/web'
import { forumsKeys } from './use-forums-queries'

interface ForumWebsocketEvent {
  type:
    | 'post/create'
    | 'post/edit'
    | 'post/delete'
    | 'post/lock'
    | 'post/pin'
    | 'post/remove'
    | 'post/restore'
    | 'comment/create'
    | 'comment/edit'
    | 'comment/delete'
    | 'comment/remove'
    | 'comment/restore'
    | 'tag/add'
    | 'tag/remove'
  forum: string
  post?: string
  comment?: string
  sender?: string
  /** Present on tag/add (object with id, label, source) and tag/remove (tag ID string) */
  tag?: { id: string; label: string; source: string } | string
}

const RECONNECT_DELAY = 3000

function getWebSocketUrl(key: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/_/websocket?key=${key}`
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
 */
export function useForumWebsocket(forumKey?: string, userId?: string) {
  const queryClient = useQueryClient()

  // Use ref for userId so it doesn't cause reconnections
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  useEffect(() => {
    // WebSocket can't connect from sandboxed iframe (opaque origin, no cookies)
    if (!forumKey || isInShell()) return

    const handleMessage = (data: ForumWebsocketEvent) => {
      // Skip events from the current user (optimistic UI already applied)
      if (userIdRef.current && data.sender === userIdRef.current) return

      const forumId = data.forum

      switch (data.type) {
        case 'post/create':
        case 'post/edit':
        case 'post/delete':
        case 'post/lock':
        case 'post/pin':
        case 'post/remove':
        case 'post/restore':
        case 'tag/add':
        case 'tag/remove':
          // Invalidate the posts list for this forum
          void queryClient.invalidateQueries({
            queryKey: ['forum-posts'],
            predicate: (query) => {
              const key = query.queryKey
              return key[0] === 'forum-posts' && key[1] === forumId
            },
          })
          // Also refresh the specific post detail if we know the post ID
          if (data.post) {
            void queryClient.invalidateQueries({
              queryKey: forumsKeys.post(forumId, data.post),
            })
          }
          break
        case 'comment/create':
        case 'comment/edit':
        case 'comment/delete':
        case 'comment/remove':
        case 'comment/restore':
          // Invalidate the specific post detail to show updated comments
          if (data.post) {
            void queryClient.invalidateQueries({
              queryKey: forumsKeys.post(forumId, data.post),
            })
          }
          break
      }
    }

    const unsubscribe = wsManager.subscribe(forumKey, handleMessage)
    return unsubscribe
  }, [forumKey, queryClient]) // Note: userId NOT in deps - uses ref instead
}
