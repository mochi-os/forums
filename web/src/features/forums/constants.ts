// Member access options for forum creation
export const memberAccessOptions = [
  {
    value: 'restricted',
    label: 'Not access the forum until approved by an administrator',
  },
  {
    value: 'view-only',
    label: 'View the forum, but not post, comment, or vote',
  },
  {
    value: 'vote-only',
    label: 'Vote, but not post or comment',
  },
  {
    value: 'comment-vote',
    label: 'Comment and vote, but not post',
  },
  {
    value: 'full-access',
    label: 'Post, comment, and vote',
  },
]

// Member roles for role management in members dialog
export const MEMBER_ROLES = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'voter', label: 'Voter' },
  { value: 'commenter', label: 'Commenter' },
  { value: 'poster', label: 'Poster' },
  { value: 'administrator', label: 'Administrator' },
] as const

// Thread status types
export type ThreadStatus = 'open' | 'resolved' | 'announcement'

export const THREAD_STATUSES: ThreadStatus[] = ['open', 'resolved', 'announcement']
