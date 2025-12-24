// Access levels for forum permissions (hierarchical - higher grants lower)
// view < vote < comment < post < manage
export const ACCESS_LEVELS = [
  { value: 'view', label: 'View only', description: 'Can view posts and comments' },
  { value: 'vote', label: 'Vote', description: 'Can vote on posts and comments' },
  { value: 'comment', label: 'Comment', description: 'Can comment and vote' },
  { value: 'post', label: 'Post', description: 'Can create posts, comment, and vote' },
  { value: 'manage', label: 'Manage', description: 'Full access including member management' },
  { value: 'none', label: 'No access', description: 'Blocked from accessing the forum' },
] as const

// Legacy: Member roles (deprecated - use ACCESS_LEVELS instead)
export const MEMBER_ROLES = ACCESS_LEVELS

// Thread status types
export type ThreadStatus = 'open' | 'resolved' | 'announcement'

export const THREAD_STATUSES: ThreadStatus[] = ['open', 'resolved', 'announcement']
