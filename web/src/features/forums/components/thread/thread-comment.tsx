import { useState, useEffect } from 'react'
import {
  Button,
  CommentTreeLayout,
  ConfirmDialog,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@mochi/common'
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Pencil,
  Trash2,
  Send,
  X,
  EyeOff,
  Eye,
  Check,
  Flag,
  Clock,
  VolumeX,
  Ban,
  MoreHorizontal,
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
  // Moderation fields
  status?: 'approved' | 'pending' | 'removed'
  remover?: string
  reason?: string
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
  // Moderation
  canModerate?: boolean
  onRemove?: (commentId: string) => void
  onRestore?: (commentId: string) => void
  onApprove?: (commentId: string) => void
  onReport?: (commentId: string) => void
  onMuteAuthor?: (userId: string) => void
  onBanAuthor?: (userId: string) => void
  currentUserId?: string
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
  canModerate = false,
  onRemove,
  onRestore,
  onApprove,
  onReport,
  onMuteAuthor,
  onBanAuthor,
  currentUserId,
}: ThreadCommentProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Moderation status
  const isPending = comment.status === 'pending'
  const isRemoved = comment.status === 'removed'

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
    <div className='bg-primary text-primary-foreground z-10 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'>
      {comment.name.charAt(0).toUpperCase()}
    </div>
  )

  const collapsedContent = (
    <div className='flex h-5 items-center gap-2 py-0.5 text-xs select-none'>
      <span className='text-muted-foreground font-medium'>{comment.name}</span>
      <span className='text-muted-foreground'>·</span>
      <span className='text-muted-foreground'>{comment.created_local}</span>
      {totalDescendants > 0 && (
        <span className='text-muted-foreground ml-2'>
          {totalDescendants} {totalDescendants === 1 ? 'reply' : 'replies'}
        </span>
      )}
    </div>
  )

  const content = (
    <div className='comment-content group/row space-y-1.5'>
      {/* Header row with status badges */}
      <div className='flex h-5 items-center gap-2 text-xs'>
        <span className='text-foreground font-medium'>{comment.name}</span>
        <span className='text-muted-foreground'>·</span>
        <span className='text-muted-foreground'>
          {comment.created_local}
          {comment.edited ? ' (edited)' : ''}
        </span>
        {/* Status badges */}
        {isPending && (
          <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
            <Clock className='size-2.5' />
            Pending
          </span>
        )}
        {isRemoved && (
          <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
            <EyeOff className='size-2.5' />
            Removed
          </span>
        )}
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
        <p
          className={cn(
            'text-foreground text-sm leading-relaxed whitespace-pre-wrap',
            isRemoved && 'opacity-60'
          )}
        >
          {comment.body}
        </p>
      )}

      {/* Votes and actions row */}
      {(canVote || canReply || commentCanEdit || canModerate || onReport) && (
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
          <div className='comment-actions pointer-events-none flex items-center gap-1 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100'>
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
                  onClick={() => handleVote(localVote === 'down' ? '' : 'down')}
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
            {/* More menu (edit, delete, moderation, report) */}
            {(commentCanEdit || canModerate || onReport) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors'
                  >
                    <MoreHorizontal className='size-4' />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                  {commentCanEdit && onEdit && (
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(comment.id)
                        setEditBody(comment.body)
                      }}
                    >
                      <Pencil className='mr-2 size-4' />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {commentCanEdit && onDelete && (
                    <DropdownMenuItem onClick={() => setDeleting(true)}>
                      <Trash2 className='mr-2 size-4' />
                      Delete
                    </DropdownMenuItem>
                  )}
                  {commentCanEdit &&
                    (canModerate ||
                      (onReport && currentUserId !== comment.member)) && (
                      <DropdownMenuSeparator />
                    )}
                  {canModerate && (
                    <>
                      {isPending && onApprove && (
                        <DropdownMenuItem onClick={() => onApprove(comment.id)}>
                          <Check className='mr-2 size-4' />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {isRemoved
                        ? onRestore && (
                            <DropdownMenuItem
                              onClick={() => onRestore(comment.id)}
                            >
                              <Eye className='mr-2 size-4' />
                              Restore
                            </DropdownMenuItem>
                          )
                        : onRemove && (
                            <DropdownMenuItem onClick={() => setRemoving(true)}>
                              <EyeOff className='mr-2 size-4' />
                              Remove
                            </DropdownMenuItem>
                          )}
                    </>
                  )}
                  {onReport && currentUserId !== comment.member && (
                    <DropdownMenuItem onClick={() => onReport(comment.id)}>
                      <Flag className='mr-2 size-4' />
                      Report
                    </DropdownMenuItem>
                  )}
                  {canModerate && (onMuteAuthor || onBanAuthor) && (
                    <DropdownMenuSeparator />
                  )}
                  {canModerate && onMuteAuthor && (
                    <DropdownMenuItem
                      onClick={() => onMuteAuthor(comment.member)}
                    >
                      <VolumeX className='mr-2 size-4' />
                      Mute author
                    </DropdownMenuItem>
                  )}
                  {canModerate && onBanAuthor && (
                    <DropdownMenuItem
                      onClick={() => onBanAuthor(comment.member)}
                    >
                      <Ban className='mr-2 size-4' />
                      Ban author
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
        destructive={true}
        handleConfirm={() => {
          onDelete?.(comment.id)
          setDeleting(false)
        }}
      />

      {/* Remove confirmation dialog */}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title='Remove comment'
        desc='This will hide the comment from regular users. Moderators can still see it and restore it later.'
        confirmText='Remove'
        handleConfirm={() => {
          onRemove?.(comment.id)
          setRemoving(false)
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
          canModerate={canModerate}
          onRemove={onRemove}
          onRestore={onRestore}
          onApprove={onApprove}
          onReport={onReport}
          onMuteAuthor={onMuteAuthor}
          onBanAuthor={onBanAuthor}
          currentUserId={currentUserId}
        />
      ))}
    </>
  ) : null

  return (
    <CommentTreeLayout
      depth={depth}
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
