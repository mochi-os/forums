import { useState, useEffect } from 'react'
import { Button, CommentTreeLayout, ConfirmDialog } from '@mochi/common'
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Pencil,
  Trash2,
  Send,
  X,
  Plus,
} from 'lucide-react'

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
  isLastChild?: boolean
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
  isLastChild = true,
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
    if (prevVote === 'up') setLocalUp((v) => v - 1)
    if (prevVote === 'down') setLocalDown((v) => v - 1)
    if (newVote === 'up') setLocalUp((v) => v + 1)
    if (newVote === 'down') setLocalDown((v) => v + 1)
    setLocalVote(newVote)
    onVote(comment.id, newVote)
  }

  const isReplying = replyingToId === comment.id
  const commentCanEdit = canEdit?.(comment.member) ?? false
  const hasReplies = comment.children && comment.children.length > 0
  const hasVotes = localUp > 0 || localDown > 0

  const getTotalReplyCount = (c: ThreadCommentType): number => {
    if (!c.children) return 0
    return (
      c.children.length +
      c.children.reduce((acc, reply) => acc + getTotalReplyCount(reply), 0)
    )
  }
  const totalDescendants = getTotalReplyCount(comment)

  const avatar = (
    <div className='bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'>
      {comment.name.charAt(0).toUpperCase()}
    </div>
  )

  const collapsedContent = (
    <div className='flex h-5 items-center gap-2 py-0.5 text-xs select-none'>
      <span className='text-muted-foreground font-medium'>{comment.name}</span>
      <span className='text-muted-foreground'>·</span>
      <span className='text-muted-foreground'>{comment.created_local}</span>
      <button
        onClick={() => setCollapsed(false)}
        className='text-primary ml-2 flex cursor-pointer items-center gap-1 hover:underline'
      >
        {totalDescendants > 0 ? (
          <>
            {totalDescendants === 1 ? (
              <span>1 reply</span>
            ) : (
              <span className='flex items-center gap-1'>
                <Plus className='size-3' />
                {totalDescendants} more replies
              </span>
            )}
          </>
        ) : (
          <span className='text-muted-foreground italic'>(collapsed)</span>
        )}
      </button>
    </div>
  )

  const content = (
    <div className='comment-content group/row space-y-1.5'>
      {/* Header row - always visible like Feeds */}
      <div className='flex h-5 items-center gap-2 text-xs'>
        <span className='text-foreground font-medium'>{comment.name}</span>
        <span className='text-muted-foreground'>·</span>
        <span className='text-muted-foreground'>
          {comment.created_local}
          {comment.edited ? ' (edited)' : ''}
        </span>
      </div>

      {/* Comment body - show edit form if editing */}
      {editing === comment.id ? (
        <div className='space-y-2'>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className='min-h-16 w-full resize-none rounded-md border px-3 py-2 text-sm'
            rows={3}
            autoFocus
          />
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs'
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              size='sm'
              className='h-7 text-xs'
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
        <p className='text-foreground text-sm leading-relaxed whitespace-pre-wrap'>
          {comment.body}
        </p>
      )}

      {/* Votes and actions row */}
      {(canVote || canReply || commentCanEdit) && (
        <div
          className={`comment-actions-row text-muted-foreground flex min-h-[28px] items-center gap-3 pt-1 text-xs ${hasVotes ? 'has-votes' : ''}`}
        >
          {/* Vote counts - always visible */}
          {localUp > 0 && (
            <span className='flex items-center gap-1'>
              <ThumbsUp className='size-3' />
              {localUp}
            </span>
          )}
          {localDown > 0 && (
            <span className='flex items-center gap-1'>
              <ThumbsDown className='size-3' />
              {localDown}
            </span>
          )}
          {/* Action buttons - visible on hover only */}
          <div className='comment-actions flex items-center gap-1 opacity-0 transition-opacity pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto'>
            {canVote && (
              <>
                <button
                  type='button'
                  className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                  style={
                    localVote === 'up'
                      ? {
                          color: 'hsl(var(--primary))',
                          fontWeight: 500,
                        }
                      : undefined
                  }
                  onClick={() => handleVote(localVote === 'up' ? '' : 'up')}
                >
                  <ThumbsUp className='size-3' />
                  <span>Upvote</span>
                </button>
                <button
                  type='button'
                  className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                  style={
                    localVote === 'down'
                      ? {
                          color: 'hsl(var(--primary))',
                          fontWeight: 500,
                        }
                      : undefined
                  }
                  onClick={() =>
                    handleVote(localVote === 'down' ? '' : 'down')
                  }
                >
                  <ThumbsDown className='size-3' />
                  <span>Downvote</span>
                </button>
              </>
            )}
            {canReply && onReply && (
              <button
                type='button'
                className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                onClick={() => onReply(comment.id)}
              >
                <MessageSquare className='size-3' />
                <span>Reply</span>
              </button>
            )}
            {commentCanEdit && onEdit && (
              <button
                type='button'
                className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                onClick={() => {
                  setEditing(comment.id)
                  setEditBody(comment.body)
                }}
              >
                <Pencil className='size-3' />
                <span>Edit</span>
              </button>
            )}
            {commentCanEdit && onDelete && (
              <button
                type='button'
                className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                onClick={() => setDeleting(true)}
              >
                <Trash2 className='size-3' />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title='Delete comment'
        desc='Are you sure you want to delete this comment? This will also delete all replies. This action cannot be undone.'
        confirmText='Delete'
        handleConfirm={() => {
          onDelete?.(comment.id)
          setDeleting(false)
        }}
      />

      {/* Reply input */}
      {isReplying && (
        <div className='mt-2 flex items-end gap-2'>
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
            className='flex-1 resize-none rounded-md border px-3 py-2 text-sm'
            rows={2}
            autoFocus
          />
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='size-8'
            onClick={onReplyCancel}
            aria-label='Cancel reply'
          >
            <X className='size-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            className='size-8'
            disabled={!replyValue.trim() || isReplyPending}
            onClick={() => onReplySubmit?.(comment.id)}
            aria-label='Submit reply'
          >
            <Send className='size-4' />
          </Button>
        </div>
      )}
    </div>
  )

  const children = hasReplies ? (
    <>
      {comment.children.map((reply, index) => (
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
          isLastChild={index === comment.children.length - 1}
        />
      ))}
    </>
  ) : null

  return (
    <CommentTreeLayout
      depth={depth}
      isLastChild={isLastChild}
      isCollapsed={collapsed}
      onToggleCollapse={() => setCollapsed(!collapsed)}
      hasChildren={hasReplies}
      avatar={avatar}
      content={content}
      collapsedContent={collapsedContent}
    >
      {children}
    </CommentTreeLayout>
  )
}

