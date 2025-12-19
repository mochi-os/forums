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
  role_voter: boolean
  role_commenter: boolean
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
  vote: 'up' | 'down'
}

export interface VoteCommentResponse {
  data: {
    forum: string
    post: string
  }
}
