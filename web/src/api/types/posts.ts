// Post Types - Based on forums.yaml specification
import type { Forum, Member } from './forums'

// Attachment interface based on API response
export interface Attachment {
  id: string
  caption: string
  content_type: string
  created: number
  creator: string
  description: string
  entity: string
  image: boolean
  name: string
  object: string
  rank: number
  size: number
  thumbnail_url: string
  type: string
  url: string
}

export interface Post {
  id: string
  forum: string
  fingerprint?: string
  member: string
  name: string
  title: string
  body: string
  body_markdown?: string
  // API may return either a count (number) or an array of comment objects
  comments: number | unknown[]
  comment_list?: unknown[] // API returns comment objects here
  up: number
  down: number
  created: number
  updated: number
  edited?: number
  created_local: string
  user_vote?: 'up' | 'down' | ''
  attachments?: Attachment[]
  forumName?: string
  // Moderation fields
  status?: 'approved' | 'pending' | 'removed'
  locked?: boolean
  pinned?: boolean
  remover?: string
  reason?: string
}

// Helper to safely get comment count
export function getCommentCount(
  comments: number | unknown[] | undefined
): number {
  if (typeof comments === 'number') return comments
  if (Array.isArray(comments)) return comments.length
  return 0
}

export interface GetNewPostParams {
  forum: string
}

export interface GetNewPostResponse {
  data: {
    forum: Forum
  }
}

export interface CreatePostRequest {
  forum: string
  title: string
  body: string
  attachments?: File[]
}

export interface CreatePostResponse {
  data: {
    forum: string
    post: string
  }
}

export interface ViewPostParams {
  forum: string
  post: string
  server?: string
}

// Comment type used in ViewPostResponse
export interface ViewPostComment {
  id: string
  forum: string
  post: string
  parent: string
  member: string
  name: string
  body: string
  up: number
  down: number
  created: number
  created_local: string
  edited?: number
  user_vote?: 'up' | 'down' | ''
  children: ViewPostComment[]
  can_vote: boolean
  can_comment: boolean
  // Moderation fields
  status?: 'approved' | 'pending' | 'removed'
  remover?: string
  reason?: string
}

export interface ViewPostResponse {
  data: {
    forum: Forum
    post: Post
    comments: ViewPostComment[]
    member: Member
    can_vote: boolean
    can_comment: boolean
    can_moderate: boolean
  }
}

export interface VotePostRequest {
  forum: string
  post: string
  vote: 'up' | 'down' | ''
}

export interface VotePostResponse {
  data: {
    forum: string
    post: string
  }
}

export interface EditPostRequest {
  forum: string
  post: string
  title: string
  body: string
  order?: string[] // Array of attachment IDs (existing) or "new:N" placeholders
  attachments?: File[] // New files to upload
}

export interface EditPostResponse {
  data: {
    forum: string
    post: string
  }
}

export interface DeletePostRequest {
  forum: string
  post: string
}

export interface DeletePostResponse {
  data: {
    forum: string
  }
}
