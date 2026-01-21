// Moderation Types for Forums

import type { Forum } from './forums'
import type { Post } from './posts'
import type { Comment } from './comments'

// Content status
export type ContentStatus = 'approved' | 'pending' | 'removed'

// Restriction types
export type RestrictionType = 'muted' | 'banned' | 'shadowban'

// Moderation settings for a forum
export interface ModerationSettings {
  moderation_posts: boolean
  moderation_comments: boolean
  moderation_new: boolean
  new_user_days: number
  post_limit: number
  comment_limit: number
  limit_window: number
}

// User restriction
export interface Restriction {
  forum: string
  user: string
  name?: string
  type: RestrictionType
  reason: string
  moderator: string
  moderator_name?: string
  expires: number | null
  created: number
}

// Report
export interface Report {
  id: string
  forum: string
  reporter: string
  reporter_name?: string
  type: 'post' | 'comment'
  target: string
  author: string
  author_name?: string
  reason: string
  details: string
  status: 'pending' | 'resolved'
  resolver?: string
  resolver_name?: string
  action?: string
  created: number
  resolved?: number
  content_title?: string
  content_preview?: string
}

// Moderation log entry
export interface ModerationLogEntry {
  id: string
  forum: string
  moderator: string
  moderator_name?: string
  action: string
  type: 'post' | 'comment' | 'user'
  target: string
  author?: string
  author_name?: string
  reason: string
  created: number
}

// Moderation queue item (pending post or comment)
export interface QueueItem {
  type: 'post' | 'comment'
  id: string
  forum: string
  post?: string
  title?: string
  body: string
  author: string
  author_name?: string
  created: number
}

// API Request/Response types

export interface GetModerationSettingsParams {
  forum: string
}

export interface GetModerationSettingsResponse {
  data: {
    forum: Forum
    settings: ModerationSettings
  }
}

export interface SaveModerationSettingsRequest {
  forum: string
  moderation_posts: boolean
  moderation_comments: boolean
  moderation_new: boolean
  new_user_days: number
  post_limit: number
  comment_limit: number
  limit_window: number
}

export interface SaveModerationSettingsResponse {
  data: {
    forum: string
  }
}

export interface GetModerationQueueParams {
  forum: string
}

export interface GetModerationQueueResponse {
  data: {
    forum: Forum
    posts: Post[]
    comments: Comment[]
  }
}

export interface GetModerationLogParams {
  forum: string
  limit?: number
  before?: number
}

export interface GetModerationLogResponse {
  data: {
    forum: Forum
    entries: ModerationLogEntry[]
    hasMore: boolean
    nextCursor: number | null
  }
}

export interface GetReportsParams {
  forum: string
  status?: 'pending' | 'resolved' | 'all'
}

export interface GetReportsResponse {
  data: {
    forum: Forum
    reports: Report[]
  }
}

export interface ResolveReportRequest {
  forum: string
  report: string
  action: string
}

export interface ResolveReportResponse {
  data: {
    report: string
  }
}

export interface GetRestrictionsParams {
  forum: string
}

export interface GetRestrictionsResponse {
  data: {
    forum: Forum
    restrictions: Restriction[]
  }
}

export interface RestrictUserRequest {
  forum: string
  user: string
  type: RestrictionType
  reason?: string
  expires?: number
}

export interface RestrictUserResponse {
  data: {
    user: string
    type: RestrictionType
  }
}

export interface UnrestrictUserRequest {
  forum: string
  user: string
}

export interface UnrestrictUserResponse {
  data: {
    user: string
  }
}

// Post moderation actions
export interface RemovePostRequest {
  forum: string
  post: string
  reason?: string
}

export interface RemovePostResponse {
  data: {
    post: string
  }
}

export interface RestorePostRequest {
  forum: string
  post: string
}

export interface RestorePostResponse {
  data: {
    post: string
  }
}

export interface ApprovePostRequest {
  forum: string
  post: string
}

export interface ApprovePostResponse {
  data: {
    post: string
  }
}

export interface LockPostRequest {
  forum: string
  post: string
}

export interface LockPostResponse {
  data: {
    post: string
  }
}

export interface UnlockPostRequest {
  forum: string
  post: string
}

export interface UnlockPostResponse {
  data: {
    post: string
  }
}

export interface PinPostRequest {
  forum: string
  post: string
}

export interface PinPostResponse {
  data: {
    post: string
  }
}

export interface UnpinPostRequest {
  forum: string
  post: string
}

export interface UnpinPostResponse {
  data: {
    post: string
  }
}

export interface ReportPostRequest {
  forum: string
  post: string
  reason: string
  details?: string
}

export interface ReportPostResponse {
  data: {
    report: string
  }
}

// Comment moderation actions
export interface RemoveCommentRequest {
  forum: string
  post: string
  comment: string
  reason?: string
}

export interface RemoveCommentResponse {
  data: {
    comment: string
  }
}

export interface RestoreCommentRequest {
  forum: string
  post: string
  comment: string
}

export interface RestoreCommentResponse {
  data: {
    comment: string
  }
}

export interface ApproveCommentRequest {
  forum: string
  post: string
  comment: string
}

export interface ApproveCommentResponse {
  data: {
    comment: string
  }
}

export interface ReportCommentRequest {
  forum: string
  post: string
  comment: string
  reason: string
  details?: string
}

export interface ReportCommentResponse {
  data: {
    report: string
  }
}
