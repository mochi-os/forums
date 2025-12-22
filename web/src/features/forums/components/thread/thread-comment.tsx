import { useState, useEffect } from 'react'
import { Button, ConfirmDialog } from '@mochi/common'
import { ThumbsUp, ThumbsDown, MessageSquare, Pencil, Trash2, Send, X } from 'lucide-react'

// Reddit-style rainbow colors for nested comment threads
const THREAD_COLORS = [
  'bg-blue-500',
  'bg-cyan-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-pink-500',
  'bg-purple-500',
]

// Comment interface aligned with ViewPostResponse.data.comments from API
export interface ThreadCommentType {
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
  children: ThreadCommentType[]
  can_vote: boolean
  can_comment: boolean
}

interface ThreadCommentProps {
  comment: ThreadCommentType
  onVote: (commentId: string, vote: 'up' | 'down' | '') => void
  canVote?: boolean
  votePendingId?: string | null
  canReply?: boolean
  onReply?: (commentId: string) => void
  replyingToId?: string | null
  replyValue?: string
  onReplyChange?: (value: string) => void
  onReplySubmit?: (commentId: string) => void
  onReplyCancel?: () => void
  isReplyPending?: boolean
  canEdit?: (commentMember: string) => boolean
  onEdit?: (commentId: string, body: string) => void
  onDelete?: (commentId: string) => void
  editPendingId?: string | null
  depth?: number
}

export function ThreadComment({
  comment,
  onVote,
  canVote = true,
  votePendingId = null,
  canReply = false,
  onReply,
  replyingToId = null,
  replyValue = '',
  onReplyChange,
  onReplySubmit,
  onReplyCancel,
  isReplyPending = false,
  canEdit,
  onEdit,
  onDelete,
  editPendingId = null,
  depth = 0,
}: ThreadCommentProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Local vote state to prevent re-render flicker
  const [localVote, setLocalVote] = useState(comment.user_vote || '')
  const [localUp, setLocalUp] = useState(comment.up)
  const [localDown, setLocalDown] = useState(comment.down)

  // Sync from server when comment changes
  useEffect(() => {
    setLocalVote(comment.user_vote || '')
    setLocalUp(comment.up)
    setLocalDown(comment.down)
  }, [comment.id])

  const handleVote = (newVote: 'up' | 'down' | '') => {
    const prevVote = localVote
    if (prevVote === 'up') setLocalUp(v => v - 1)
    if (prevVote === 'down') setLocalDown(v => v - 1)
    if (newVote === 'up') setLocalUp(v => v + 1)
    if (newVote === 'down') setLocalDown(v => v + 1)
    setLocalVote(newVote)
    onVote(comment.id, newVote)
  }

  const isReplying = replyingToId === comment.id
  const commentCanEdit = canEdit?.(comment.member) ?? false
  const hasReplies = comment.children && comment.children.length > 0
  const lineColor = THREAD_COLORS[depth % THREAD_COLORS.length]
  const hasVotes = localUp > 0 || localDown > 0

  return (
    <div className="flex">
      {/* Colored thread line */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="group flex-shrink-0 w-5 flex justify-center cursor-pointer"
        aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
      >
        <div className={`w-0.5 h-full ${lineColor} opacity-40 group-hover:opacity-100 transition-opacity`} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2 pl-2">
        {/* Collapsed state */}
        {collapsed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{comment.name} · {comment.created_local}</span>
            <span className="text-primary">
              {hasReplies ? `(${comment.children.length} replies hidden)` : '(collapsed)'}
            </span>
          </div>
        )}

        {!collapsed && (
          <>
            {/* Comment's own content - hover target excludes nested replies */}
            <div className="comment-content space-y-2">
              {/* Comment body - show edit form if editing */}
              {editing === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none min-h-16"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!editBody.trim()}
                      onClick={() => {
                        onEdit?.(comment.id, editBody.trim())
                        setEditing(null)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap pr-32">{comment.body}</p>
                  {/* Author and timestamp - hidden until hover */}
                  <span className="comment-meta absolute top-0 right-0 text-xs text-muted-foreground transition-opacity">
                    {comment.name} · {comment.created_local}
                    {comment.edited ? ' (edited)' : ''}
                  </span>
                </div>
              )}

              {/* Votes and actions row */}
              {(canVote || canReply || commentCanEdit) && (
                <div className={`comment-actions-row flex items-center gap-3 text-xs text-muted-foreground pt-1 ${hasVotes ? 'has-votes' : ''}`}>
                  {/* Vote counts */}
                  {localUp > 0 && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="size-3" />
                      {localUp}
                    </span>
                  )}
                  {localDown > 0 && (
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="size-3" />
                      {localDown}
                    </span>
                  )}
                  {/* Action buttons - visible on hover */}
                  <div className="comment-actions flex items-center gap-3">
                    {canVote && (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          style={localVote === 'up' ? { color: 'hsl(var(--primary))', fontWeight: 500 } : undefined}
                          onClick={() => handleVote(localVote === 'up' ? '' : 'up')}
                        >
                          <ThumbsUp className="size-3" />
                          <span>Upvote</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          style={localVote === 'down' ? { color: 'hsl(var(--primary))', fontWeight: 500 } : undefined}
                          onClick={() => handleVote(localVote === 'down' ? '' : 'down')}
                        >
                          <ThumbsDown className="size-3" />
                          <span>Downvote</span>
                        </button>
                      </>
                    )}
                    {canReply && onReply && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => onReply(comment.id)}
                      >
                        <MessageSquare className="size-3" />
                        Reply
                      </button>
                    )}
                    {commentCanEdit && onEdit && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          setEditing(comment.id)
                          setEditBody(comment.body)
                        }}
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                    )}
                    {commentCanEdit && onDelete && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setDeleting(true)}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Delete confirmation dialog */}
              <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                title="Delete comment"
                desc="Are you sure you want to delete this comment? This will also delete all replies. This action cannot be undone."
                confirmText="Delete"
                handleConfirm={() => {
                  onDelete?.(comment.id)
                  setDeleting(false)
                }}
              />

              {/* Reply input */}
              {isReplying && (
                <div className="flex items-end gap-2 mt-2">
                  <textarea
                    placeholder={`Reply to ${comment.name}...`}
                    value={replyValue}
                    onChange={(e) => onReplyChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        if (replyValue.trim()) {
                          onReplySubmit?.(comment.id)
                        }
                      } else if (e.key === 'Escape') {
                        onReplyCancel?.()
                      }
                    }}
                    className="flex-1 border rounded-md px-3 py-2 text-sm resize-none"
                    rows={2}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={onReplyCancel}
                    aria-label="Cancel reply"
                  >
                    <X className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="size-8"
                    disabled={!replyValue.trim() || isReplyPending}
                    onClick={() => onReplySubmit?.(comment.id)}
                    aria-label="Submit reply"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Nested replies */}
            {hasReplies && (
              <div className="mt-1 space-y-1">
                {comment.children.map((reply) => (
                  <ThreadComment
                    key={reply.id}
                    comment={reply}
                    onVote={onVote}
                    canVote={canVote}
                    votePendingId={votePendingId}
                    canReply={canReply}
                    onReply={onReply}
                    replyingToId={replyingToId}
                    replyValue={replyValue}
                    onReplyChange={onReplyChange}
                    onReplySubmit={onReplySubmit}
                    onReplyCancel={onReplyCancel}
                    isReplyPending={isReplyPending}
                    canEdit={canEdit}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    editPendingId={editPendingId}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
