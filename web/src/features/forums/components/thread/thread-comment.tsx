import { useRef, useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button, CommentTreeLayout, ConfirmDialog, EntityAvatar, MentionTextarea, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useFormat, renderMentions, useImageObjectUrls, getAppPath, type MentionUser } from '@mochi/web'
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
  Paperclip,
} from 'lucide-react'
import type { Attachment } from '@/api/types/posts'
import { CommentAttachments } from '../comment-attachments'
import { t } from '@lingui/core/macro'

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
  edited?: number
  user_vote?: 'up' | 'down' | ''
  children: ThreadCommentType[]
  attachments?: Attachment[]
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
  onReplySubmit?: (commentId: string, files?: File[]) => void
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
  onSearchPeople?: (query: string) => Promise<MentionUser[]>
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
  onSearchPeople,
}: ThreadCommentProps) {
  const { formatTimestamp } = useFormat()
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const replyPreviewUrls = useImageObjectUrls(replyFiles)
  const replyFileRef = useRef<HTMLInputElement>(null)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const voteButtonClass = 'text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:-m-1 md:min-h-0 md:rounded-none md:px-1 md:py-1'
  const iconActionButtonClass = 'text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:size-auto md:rounded-none md:p-0'

  const getTotalReplyCount = (c: ThreadCommentType): number => {
    if (!c.children) return 0
    return (
      c.children.length +
      c.children.reduce((acc, reply) => acc + getTotalReplyCount(reply), 0)
    )
  }
  const totalDescendants = getTotalReplyCount(comment)

  const assetUrl = (slot: string) =>
    `${getAppPath()}/${comment.forum}/-/${comment.post}/${comment.id}/asset/${slot}`
  const avatar = (
    <EntityAvatar
      src={assetUrl('avatar')}
      styleUrl={assetUrl('style')}
      seed={comment.member}
      name={comment.name}
      size="xs"
      className='z-10'
    />
  )

  const collapsedContent = (
    <div className='flex h-5 items-center gap-2 py-0.5 text-xs select-none'>
      <span className='text-muted-foreground font-medium'>{comment.name}</span>
      <span className='text-muted-foreground'>·</span>
      <span className='text-muted-foreground'>{formatTimestamp(comment.created)}</span>
      {totalDescendants > 0 && (
        <span className='text-muted-foreground ms-2'>
          {totalDescendants} {totalDescendants === 1 ? 'reply' : 'replies'}
        </span>
      )}
    </div>
  )

  const content = (
    <div className='comment-content group/row space-y-2 md:space-y-1.5'>
      {/* Header row with status badges */}
      <div className='flex h-5 items-center gap-2 text-xs'>
        <span className='text-foreground font-medium'>{comment.name}</span>
        <span className='text-muted-foreground'>·</span>
        <span className='text-muted-foreground'>
          {formatTimestamp(comment.created)}
          {comment.edited ? ' (edited)' : ''}
        </span>
        {/* Status badges */}
        {isPending && (
          <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
            <Clock className='size-2.5' />
            <Trans>Pending</Trans>
          </span>
        )}
        {isRemoved && (
          <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
            <EyeOff className='size-2.5' />
            <Trans>Removed</Trans>
          </span>
        )}
      </div>

      {/* Comment body - show edit form if editing */}
      {editing === comment.id ? (
        <div className='space-y-2'>
          <MentionTextarea
            value={editBody}
            onValueChange={setEditBody}
            onSearchPeople={onSearchPeople}
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
              <Trans>Cancel</Trans>
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
              <Trans>Save</Trans>
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
          {renderMentions(comment.body)}
        </p>
      )}

      <CommentAttachments attachments={comment.attachments} />

      {/* Votes and actions row */}
      {(canVote || canReply || commentCanEdit || canModerate || onReport) && (
        <div
          className={`comment-actions-row text-muted-foreground flex min-h-8 items-center gap-2.5 pt-1.5 text-xs md:min-h-[28px] md:gap-3 md:pt-1 ${hasVotes ? 'has-votes' : ''}`}
        >
          {/* Votes */}
          {canVote ? (
            <>
              <button
                type='button'
                className={voteButtonClass}
                onClick={() => handleVote(localVote === 'up' ? '' : 'up')}
              >
                {localVote === 'up' ? <span className='text-sm'>👍</span> : <ThumbsUp className='size-4' />}
                {localUp > 0 && localUp}
              </button>
              <button
                type='button'
                className={voteButtonClass}
                onClick={() => handleVote(localVote === 'down' ? '' : 'down')}
              >
                {localVote === 'down' ? <span className='text-sm'>👎</span> : <ThumbsDown className='size-4' />}
                {localDown > 0 && localDown}
              </button>
            </>
          ) : (
            <>
              {localUp > 0 && (
                <span className='flex items-center gap-1'>
                  <ThumbsUp className='size-4' />
                  {localUp}
                </span>
              )}
              {localDown > 0 && (
                <span className='flex items-center gap-1'>
                  <ThumbsDown className='size-4' />
                  {localDown}
                </span>
              )}
            </>
          )}
          {/* Action buttons - always visible on mobile, hover-reveal on desktop */}
          <div className='comment-actions flex items-center gap-1.5 transition-opacity pointer-events-auto opacity-100 md:gap-1 md:pointer-events-none md:opacity-0 md:group-hover/row:pointer-events-auto md:group-hover/row:opacity-100'>
            {canReply && onReply && (
              <button
                type='button'
                className={iconActionButtonClass}
                onClick={() => onReply(comment.id)}
              >
                <MessageSquare className='size-4' />
              </button>
            )}
            {/* More menu (edit, delete, moderation, report) */}
            {(commentCanEdit || canModerate || onReport) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    className={iconActionButtonClass}
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
                      <Pencil className='me-2 size-4' />
                      <Trans>Edit</Trans>
                    </DropdownMenuItem>
                  )}
                  {commentCanEdit && onDelete && (
                    <DropdownMenuItem onClick={() => setDeleting(true)}>
                      <Trash2 className='me-2 size-4' />
                      <Trans>Delete</Trans>
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
                          <Check className='me-2 size-4' />
                          <Trans>Approve</Trans>
                        </DropdownMenuItem>
                      )}
                      {isRemoved
                        ? onRestore && (
                            <DropdownMenuItem
                              onClick={() => onRestore(comment.id)}
                            >
                              <Eye className='me-2 size-4' />
                              <Trans>Restore</Trans>
                            </DropdownMenuItem>
                          )
                        : onRemove && (
                            <DropdownMenuItem onClick={() => setRemoving(true)}>
                              <EyeOff className='me-2 size-4' />
                              <Trans>Remove</Trans>
                            </DropdownMenuItem>
                          )}
                    </>
                  )}
                  {onReport && currentUserId !== comment.member && (
                    <DropdownMenuItem onClick={() => onReport(comment.id)}>
                      <Flag className='me-2 size-4' />
                      <Trans>Report</Trans>
                    </DropdownMenuItem>
                  )}
                  {canModerate && (onMuteAuthor || onBanAuthor) && (
                    <DropdownMenuSeparator />
                  )}
                  {canModerate && onMuteAuthor && (
                    <DropdownMenuItem
                      onClick={() => onMuteAuthor(comment.member)}
                    >
                      <VolumeX className='me-2 size-4' />
                      <Trans>Mute author</Trans>
                    </DropdownMenuItem>
                  )}
                  {canModerate && onBanAuthor && (
                    <DropdownMenuItem
                      onClick={() => onBanAuthor(comment.member)}
                    >
                      <Ban className='me-2 size-4' />
                      <Trans>Ban author</Trans>
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
        title={t`Delete comment`}
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
        title={t`Remove comment`}
        desc='This will hide the comment from regular users. Moderators can still see it and restore it later.'
        confirmText='Remove'
        handleConfirm={() => {
          onRemove?.(comment.id)
          setRemoving(false)
        }}
      />

      {/* Reply input */}
      {isReplying && (
        <div className='mt-2 space-y-2 border-t pt-2'>
          <MentionTextarea
            placeholder={`Reply to ${comment.name}...`}
            value={replyValue}
            onValueChange={(v) => onReplyChange?.(v)}
            onSearchPeople={onSearchPeople}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (replyValue.trim()) {
                  onReplySubmit?.(comment.id, replyFiles.length > 0 ? replyFiles : undefined)
                }
              } else if (e.key === 'Escape') {
                onReplyCancel?.()
              }
            }}
            className='min-h-0'
            rows={2}
            autoFocus
          />
          {replyFiles.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {replyFiles.map((file, i) => (
                <div key={i} className='bg-muted relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs'>
                  {file.type.startsWith('image/') && (
                    <img src={replyPreviewUrls[i] ?? undefined} alt={file.name} className='h-8 w-8 rounded object-cover' />
                  )}
                  <Paperclip className='text-muted-foreground size-3 shrink-0' />
                  <span className='max-w-40 truncate'>{file.name}</span>
                  <button type='button' onClick={() => setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))} className='text-muted-foreground hover:text-foreground ms-0.5'>
                    <X className='size-3.5' />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className='flex items-center justify-end gap-2'>
            <input
              ref={replyFileRef}
              type='file'
              multiple
              onChange={(e) => { if (e.target.files) { const f = Array.from(e.target.files); setReplyFiles((prev) => [...prev, ...f]) } e.target.value = '' }}
              className='hidden'
            />
            <Button type='button' variant='ghost' size='icon' className='size-8' onClick={() => replyFileRef.current?.click()} aria-label={t`Attach reply files`}>
              <Paperclip className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-8'
              onClick={onReplyCancel}
              aria-label={t`Cancel reply`}
            >
              <X className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              className='size-8'
              disabled={!replyValue.trim() || isReplyPending}
              onClick={() => onReplySubmit?.(comment.id, replyFiles.length > 0 ? replyFiles : undefined)}
              aria-label={t`Submit reply`}
            >
              <Send className='size-4' />
            </Button>
          </div>
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
          onSearchPeople={onSearchPeople}
        />
      ))}
    </>
  ) : null

  return (
    <CommentTreeLayout
      depth={depth}
      density='comfortable'
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
