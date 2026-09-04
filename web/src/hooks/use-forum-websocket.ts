// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  toast,
  useAuthStore,
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from '@mochi/web'
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
    | 'comment/reject'
    | 'post/remove'
    | 'post/restore'
    | 'post/status'
    | 'comment/create'
    | 'comment/edit'
    | 'comment/update'
    | 'comment/delete'
    | 'comment/remove'
    | 'comment/restore'
    | 'comment/status'
    | 'tag/add'
    | 'tag/remove'
    | 'forum/update'
  forum: string
  post?: string
  comment?: string
  sender?: string
  /** post/reject and comment/reject: machine-readable reason code from the forum owner */
  reason?: string
  /** post/status and comment/status: the status the forum settled our own submission on */
  status?: 'approved' | 'pending' | 'removed'
  /** Present on tag/add (object with id, label, source) and tag/remove (tag ID string) */
  tag?: { id: string; label: string; source: string } | string
}

// A rejection can arrive for either a post or a comment; the message must
// match, so a rejected comment doesn't tell the user their "post" was refused.
export function rejectMessage(
  reason: string | undefined,
  kind: 'post' | 'comment'
): string {
  const isComment = kind === 'comment'
  switch (reason) {
    case 'access_denied':
      return isComment
        ? t`You don't have permission to comment in this forum`
        : t`You don't have permission to post in this forum`
    case 'restricted':
      return isComment
        ? t`You are restricted from commenting in this forum`
        : t`You are restricted from posting in this forum`
    case 'rate_limited':
      return isComment
        ? t`You are commenting too quickly — please wait and try again`
        : t`You are posting too quickly — please wait and try again`
    case 'invalid':
      return isComment
        ? t`Comment couldn't be saved — it is invalid`
        : t`Post couldn't be saved — title or body is invalid`
    case 'duplicate':
      return isComment
        ? t`This comment was already submitted`
        : t`This post was already submitted`
    case 'forum_not_found':
      return t`Forum is no longer available`
    case 'server_error':
    default:
      return isComment
        ? t`Comment couldn't be saved on the forum server`
        : t`Post couldn't be saved on the forum server`
  }
}

/**
 * Subscribe to a forum's websocket events. With `onNewPost`, `post/create`
 * events go to the callback instead of invalidating the posts list.
 */
export function useForumWebsocket(
  forumKey?: string,
  userId?: string,
  onNewPost?: (postId?: string) => void,
  onSync?: () => void
) {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((state) => state.isInitialized)
  const authToken = useAuthStore((state) => state.token)

  // Use ref for userId so it doesn't cause reconnections
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // Refs so a changing callback doesn't tear down the WebSocket subscription
  const onNewPostRef = useRef(onNewPost)
  onNewPostRef.current = onNewPost
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync

  useEffect(() => {
    if (!authReady) return
    if (!forumKey) return

    const handleMessage = (event: EntityWebsocketEvent) => {
      const data = event as unknown as ForumWebsocketEvent

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
        case 'post/status': // our own submission's outcome: clears the "Pending approval" badge
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
        case 'comment/status':
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
          toast.error(rejectMessage(data.reason, 'post'))
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
        case 'comment/reject':
          // Same shape as post/reject: the owner refused the comment and the
          // Starlark handler has already deleted the optimistic pending row,
          // so the thread has to be refetched or it keeps showing it.
          toast.error(rejectMessage(data.reason, 'comment'))
          if (data.post) {
            void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, data.post) })
            if (forumKey && forumKey !== forumId) {
              void queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumKey, data.post) })
            }
          }
          break
        case 'forum/update':
          // The owner finished pushing a fresh subscriber's initial content
          // (server flipped `populated`); re-run the route loader so the board
          // leaves its loading state and renders the now-complete forum.
          onSyncRef.current?.()
          break
      }
    }

    const unsubscribe = entityWebsocketManager.subscribe(forumKey, handleMessage)
    return unsubscribe
  }, [authReady, authToken, forumKey, queryClient]) // Note: userId NOT in deps - uses ref instead
}
