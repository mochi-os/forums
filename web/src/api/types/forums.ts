// API Request/Response Types
import type { Post } from './posts'

// Forum Types - Based on forums.yaml specification

// Access levels in hierarchical order (higher grants all lower)
// Only owners have full management permissions (no separate "manage" level)
export type AccessLevel = 'view' | 'vote' | 'comment' | 'post' | 'moderate' | 'none'

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
}

// Helper to safely get member count
export function getMemberCount(
  members: number | unknown[] | undefined
): number {
  if (typeof members === 'number') return members
  if (Array.isArray(members)) return members.length
  return 0
}

export interface Member {
  forum: string
  id: string
  name: string
  subscribed: number // Timestamp when subscribed
}

// Access rule for a member (from mochi.access system)
export interface MemberAccess {
  id: string
  name: string
  level: AccessLevel | null // null = owner (implicit full access)
  isOwner?: boolean // True if this is the resource owner
}

export interface DirectoryEntry {
  id: string
  fingerprint: string
  fingerprint_hyphens: string
  name: string
  class: string
  data: string
  location: string
  created: number
  updated: number
}

export type { Post }

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
  }
}

// Union type for info response
export type InfoResponse = InfoEntityResponse | InfoClassResponse

export interface ListForumsResponse {
  data: {
    forums: Forum[]
    posts: Post[]
  }
}

export interface ViewForumParams {
  forum: string
  limit?: number
  before?: number
  server?: string
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
}

export interface CreateForumResponse {
  data: {
    id: string
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

export interface FindForumsResponse {
  data: {
    forums: DirectoryEntry[]
  }
}

export interface SubscribeForumRequest {
  forum: string
}

export interface SubscribeForumResponse {
  data: {
    already_subscribed: boolean
  }
}

export interface UnsubscribeForumRequest {
  forum: string
}

export interface UnsubscribeForumResponse {
  data: Record<string, never>
}

export interface GetNewForumResponse {
  data: Record<string, never>
}

export interface GetMembersParams {
  forum: string
}

export interface GetMembersResponse {
  data: {
    forum: Forum
    members: Member[]
  }
}

export interface SaveMembersRequest {
  forum: string
  [key: `role_${string}`]: string // Legacy - may need update for access system
}

export interface SaveMembersResponse {
  data: {
    forum: Forum
  }
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
    server: string
  }
}
