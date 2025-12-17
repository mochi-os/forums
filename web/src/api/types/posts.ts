// Post Types - Based on forums.yaml specification

import type { Forum, Member } from './forums'

export interface Post {
  id: string
  forum: string
  member: string
  name: string
  title: string
  body: string
  comments: number
  up: number
  down: number
  created: number
  updated: number
  created_local: string
  attachments?: unknown[]
  forumName?: string
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
}

export interface ViewPostResponse {
  data: {
    forum: Forum
    post: Post
    comments: Array<{
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
      children: unknown[] // Recursive type
      role_voter: boolean
      role_commenter: boolean
    }>
    member: Member
    role_voter: boolean
    role_commenter: boolean
  }
}

export interface VotePostRequest {
  forum: string
  post: string
  vote: 'up' | 'down'
}

export interface VotePostResponse {
  data: {
    forum: string
    post: string
  }
}
