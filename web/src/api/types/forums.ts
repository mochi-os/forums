// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// API Request/Response Types
import type { Post } from './posts'

// Forum Types - Based on forums.yaml specification

// Access levels in hierarchical order (higher grants all lower)
// Only owners have full management permissions (no separate "manage" level)
type AccessLevel = 'view' | 'vote' | 'comment' | 'post' | 'moderate' | 'none'

export interface Forum {
  id: string
  fingerprint: string
  name: string
  // API may return either a count (number) or an array of member objects
  members: number | unknown[]
  updated: number
  can_manage?: boolean // True if current user can manage this forum
  can_post?: boolean // True if current user can create posts
  can_moderate?: boolean // True if current user can moderate this forum
  server?: string // Server URL for remote forums (when accessing as delegated moderator)
  ai_mode?: string
  ai_account?: string
  banner?: string
  banner_html?: string
  sort?: string // Per-forum override; empty means use default
  // 0 while a freshly-subscribed forum's bulk posts are still arriving over P2P;
  // 1 (or absent, for owned / remote-preview) once present. The board shows a
  // loading state while this is 0.
  populated?: number
  // A community on another network: the linked account it is read and
  // written through, and the server's own id for it.
  account?: string
  community?: string
  // The community's address on the fediverse: a forum of ours published as
  // one, or a community joined as one of the user's hosted accounts.
  address?: string
  hosted?: string
  // Whether the forum's posts are all sensitive.
  sensitive?: number
}

export interface Member {
  forum: string
  id: string
  name: string
  subscribed: number // Timestamp when subscribed
}

// Access rule for a member (from mochi.access system)
interface MemberAccess {
  id: string
  name: string
  level: AccessLevel | null // null = owner (implicit full access)
  owner?: boolean // True if this is the resource owner
}

export interface DirectoryEntry {
  id: string
  fingerprint: string
  fingerprint_hyphens: string
  name: string
  class: string
  data: string
  location: string
  /** owner's peer from a mochi:// share-link probe; subscribe pins the same peer. */
  peer?: string
  created: number
  updated: number
  subscribed?: boolean
}

export type { Post }

// One of the user's connected accounts, as core lists them.
export interface ConnectedAccount {
  id: string
  type: string
  identifier: string
  label?: string
  name?: string
  server?: string
  hosted?: boolean
  enabled?: number | boolean
}

// What adding a linked account's subscribed communities brought.
export interface CommunitiesAddResponse {
  added: number
  communities: number
  posts: number
}

// What a step of importing a linked account's settings brought.
export interface CommunitiesImportResponse {
  communities: number
  blocks: number
  saved: number
  more: boolean
}

// A community just joined as one of the user's hosted accounts: the forum it
// became, and whether the group has accepted the follow yet.
export interface CommunityJoined {
  id: string
  fingerprint: string
  name: string
  already_subscribed: boolean
  accepted?: boolean
}

// Permissions returned by the info endpoint
export interface ForumPermissions {
  view: boolean
  post: boolean
  manage: boolean
  moderate: boolean
}

// Info endpoint response (entity context)
export interface InfoEntityResponse {
  data: {
    entity: true
    forum: Forum
    permissions: ForumPermissions
    fingerprint: string
  }
}

// Info endpoint response (class context)
export interface InfoClassResponse {
  data: {
    entity: false
    forums: Forum[]
    settings?: { sort: string }
  }
}

export interface ListForumsResponse {
  data: {
    forums: Forum[]
    posts: Post[]
    settings?: { sort: string }
    // True when the class has at least one AI-enabled forum, so the list page
    // can offer the "AI" sort option.
    hasAi?: boolean
  }
}

export interface ViewForumParams {
  forum: string
  limit?: number
  before?: number
  server?: string
  sort?: string
  tag?: string
}

export interface ViewForumResponse {
  data: {
    forum: Forum
    posts: Post[]
    member: Member
    can_manage: boolean
    can_moderate: boolean
    hasMore: boolean
    nextCursor: number | null
  }
}

export interface CreateForumRequest {
  name: string
  privacy?: 'public' | 'private'
}

export interface CreateForumResponse {
  data: {
    id: string
    fingerprint?: string
  }
}

export interface SearchForumsParams {
  search: string
}

export interface SearchForumsResponse {
  data: {
    results: DirectoryEntry[]
  }
}

export interface RecommendedForum {
  id: string
  name: string
  blurb: string
  fingerprint: string
  server: string
}

export interface RecommendationsResponse {
  data: {
    forums: RecommendedForum[]
  }
}

export interface SubscribeForumResponse {
  data: {
    already_subscribed: boolean
  }
}

export interface UnsubscribeForumResponse {
  data: Record<string, never>
}

// Access control types
export interface GetAccessParams {
  forum: string
}

export interface GetAccessResponse {
  data: {
    forum: Forum
    access: MemberAccess[]
    levels: AccessLevel[]
    owner?: { id: string; name?: string } | null
  }
}

export interface SetAccessRequest {
  forum: string
  user: string
  level: AccessLevel
}

export interface SetAccessResponse {
  data: {
    user: string
    level: AccessLevel
  }
}

export interface RevokeAccessRequest {
  forum: string
  user: string
}

export interface RevokeAccessResponse {
  data: {
    user: string
  }
}

// Member roster types
export interface ForumMember {
  id: string
  name: string
  subscribed: number
}

export interface ListMembersResponse {
  data: {
    forum: Forum
    members: ForumMember[]
  }
}

export interface RemoveMemberResponse {
  data: {
    forum: Forum
  }
}

// Probe types for remote forum lookup by URL
export interface ProbeForumRequest {
  url: string
}

export interface ProbeForumResponse {
  data: {
    id: string
    name: string
    fingerprint: string
    class: string
    server?: string
    /** owner's peer from a mochi:// share-link probe; subscribe pins the same peer. */
    peer?: string
  }
}

// The activity notifications the user has turned on for a forum.
export type NotificationKind = 'post' | 'reply' | 'comment'

export type NotificationSettings = Record<NotificationKind, boolean>

export interface NotificationSettingsResponse {
  data: NotificationSettings
}
