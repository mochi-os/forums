// Forum Types - Based on forums.yaml specification

export interface Forum {
  id: string
  fingerprint: string
  name: string
  role: '' | 'disabled' | 'viewer' | 'voter' | 'commenter' | 'poster' | 'administrator'
  members: number
  updated: number
}

export interface Member {
  forum: string
  id: string
  name: string
  role: 'disabled' | 'viewer' | 'voter' | 'commenter' | 'poster' | 'administrator'
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

// API Request/Response Types


import type { Post } from './posts'
export type { Post }

export interface ListForumsResponse {
  data: {
    forums: Forum[]
    posts: Post[]
  }
}

export interface ViewForumResponse {
  data: {
    forum: Forum
    posts: Post[]
    member: Member
    role_administrator: boolean
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
  [key: `role_${string}`]: string
}

export interface SaveMembersResponse {
  data: {
    forum: Forum
  }
}
