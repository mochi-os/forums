// Comment Types - Based on forums.yaml specification
import type { Forum } from './forums'

export interface Comment {
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
  children: Comment[]
  can_vote: boolean
  can_comment: boolean
}

export interface GetNewCommentParams {
  forum: string
  post: string
  parent?: string
}

export interface GetNewCommentResponse {
  data: {
    forum: Forum
    post: string
    parent?: string
  }
}

export interface CreateCommentRequest {
  forum: string
  post: string
  body: string
  parent?: string
}

export interface CreateCommentResponse {
  data: {
    comment: string
    forum: string
    post: string
  }
}

export interface VoteCommentRequest {
  forum: string
  post: string
  comment: string
  vote: 'up' | 'down' | ''
}

export interface VoteCommentResponse {
  data: {
    forum: string
    post: string
  }
}

export interface EditCommentRequest {
  forum: string
  post: string
  comment: string
  body: string
}

export interface EditCommentResponse {
  data: {
    forum: string
    post: string
    comment: string
  }
}

export interface DeleteCommentRequest {
  forum: string
  post: string
  comment: string
}

export interface DeleteCommentResponse {
  data: {
    forum: string
    post: string
  }
}
