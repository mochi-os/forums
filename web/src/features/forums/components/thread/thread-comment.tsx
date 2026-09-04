// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useState, useEffect } from 'react'
import { Trans, useLingui, Plural } from '@lingui/react/macro'
import { Button, CommentBox, CommentTreeLayout, ConfirmDialog, EntityAvatar, MentionTextarea, authenticatedUrl, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, useFormat, renderMentions, getAppPath, textUnchanged, type MentionUser, ActionPill, ActionPillSticky, ActionPillActions, useDiscardGuard, type Upload } from '@mochi/web'
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Check,
  Flag,
  Clock,
  VolumeX,
  Ban,
  MoreHorizontal,
} from 'lucide-react'
import type { Attachment as AttachmentData } from '@/api/types/posts'
import { CommentAttachments } from '../comment-attachments'

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
  attachments?: AttachmentData[]
  // Anchor: the id of one of the post's attachments this comment is about,
  // and its display name (caption or file name). Empty when unanchored.
  attachment?: string
  attachment_name?: string
  attachment_caption?: string
  can_vote: boolean
  can_comment: boolean
  // Moderation fields
  status?: 'approved' | 'pending' | 'removed'
  remover?: string
  reason?: string
}

export interface ThreadCommentProps {
  comment: ThreadCommentType
  onVote: (commentId: string, vote: 'up' | 'down' | '') => void
  canVote?: boolean
  canReply?: boolean
  onReply?: (commentId: string) => void
  replyingToId?: string | null
  replyValue?: string
  onReplyChange?: (value: string) => void
  /** Reports how many files this comment has staged while it is the one being
   * replied to, so the thread can warn before a switch throws them away. */
  onReplyFilesChange?: (count: number) => void
  onReplySubmit?: (commentId: string, files?: File[]) => void | Promise<void>
  /** Byte progress of an in-flight reply upload */
  replyProgress?: Upload | null
  onReplyCancel?: () => void
  canEdit?: (commentMember: string) => boolean
  onEdit?: (commentId: string, body: string) => void
  onDelete?: (commentId: string) => void
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
  /**
   * Opens the post's lightbox on the attachment a comment is anchored to,
   * comments showing.
   */
  onOpenAttachment?: (attachmentId: string) => void
}

export function ThreadComment({
  comment,
  onVote,
  canVote = true,
  canReply = false,
  onReply,
  replyingToId = null,
  replyValue = '',
  onReplyChange,
  onReplyFilesChange,
  onReplySubmit,
  replyProgress,
  onReplyCancel,
  canEdit,
  onEdit,
  onDelete,
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
  onOpenAttachment,
}: ThreadCommentProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)
  // Banning sits one row below Approve in the same menu and takes a person's
  // access to the forum, so it confirms the way Delete and Remove above it
  // already do. Muting does not: it is narrower and lifts as easily.
  const [banning, setBanning] = useState(false)
  // The reply box owns its files and reports their count; the guard here and
  // the one above (which arbitrates switching between reply boxes) read it.
  const [replyFileCount, setReplyFileCount] = useState(0)
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

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
     
  }, [comment.id, comment.user_vote, comment.up, comment.down])

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

  useEffect(() => {
    if (!isReplying) setReplyFileCount(0)
  }, [isReplying])

  const handleReplyFilesChange = useCallback(
    (count: number) => {
      setReplyFileCount(count)
      onReplyFilesChange?.(count)
    },
    [onReplyFilesChange]
  )

  // Rejects on failure so the box keeps its files for Retry: already reported
  // upstream.
  const submitReply = useCallback(
    async (_body: string, files?: File[]) => {
      setIsSubmittingReply(true)
      try {
        await onReplySubmit?.(comment.id, files)
      } finally {
        setIsSubmittingReply(false)
      }
    },
    [onReplySubmit, comment.id]
  )

  const { requestClose: requestCloseReply, discardDialog } = useDiscardGuard({
    hasText: replyValue.trim().length > 0,
    hasFiles: replyFileCount > 0,
    onDiscard: () => onReplyCancel?.(),
    locked: isSubmittingReply,
  })

  const commentCanEdit = canEdit?.(comment.member) ?? false
  const hasReplies = comment.children && comment.children.length > 0
  const hasVotes = localUp > 0 || localDown > 0
   
  const voteButtonClass = 'inline-flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 leading-none text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
  const iconActionButtonClass = 'inline-flex size-7 shrink-0 items-center justify-center rounded-full leading-none text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
   

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
          <Plural value={totalDescendants} one="# reply" other="# replies" />
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
          {comment.edited ? t` (edited)` : ''}
        </span>
        {comment.attachment && (
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground ms-1 inline-flex min-w-0 items-center gap-1 rounded transition-colors'
            onClick={(event) => {
              event.stopPropagation()
              onOpenAttachment?.(comment.attachment!)
            }}
            title={comment.attachment_name || t`On this image`}
            aria-label={t`View the image this comment is about`}
          >
            <img
              src={authenticatedUrl(
                `${getAppPath()}/${comment.forum}/-/attachments/${comment.attachment}/thumbnail`
              )}
              alt=''
              className='size-5 rounded object-cover text-transparent'
            />
            {comment.attachment_caption && (
              <span className='max-w-32 truncate'>{comment.attachment_caption}</span>
            )}
          </button>
        )}
        {/* Status badges */}
        {isPending && (
          <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
            <Clock className='size-2.5' />
            <Trans>Pending</Trans>
          </span>
        )}
        {isRemoved && (
          <span className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive'>
            <EyeOff className='size-2.5' />
            <Trans>Removed</Trans>
          </span>
        )}
      </div>

      {/* Comment body - show edit form if editing */}
      {editing === comment.id ? (
        <div className='space-y-2'>
          <MentionTextarea
            className='placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
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
              disabled={
                !editBody.trim() ||
                textUnchanged(editBody.trim(), comment.body)
              }
              onClick={() => {
                const trimmed = editBody.trim()
                if (textUnchanged(trimmed, comment.body)) {
                  setEditing(null)
                  return
                }
                onEdit?.(comment.id, trimmed)
                setEditing(null)
              }}
            >
              <Check className='size-4' />
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
          {/* Action pill */}
          <ActionPill
            sticky
            hoverGroup='row'
            expandWidth={200}
            className='comment-actions'
          >
            <ActionPillSticky>
              {/* Votes */}
              {canVote ? (
                <>
                  <button
                    type='button'
                    className={voteButtonClass}
                    onClick={() => handleVote(localVote === 'up' ? '' : 'up')}
                  >
                    {localVote === 'up' ? <span className='text-sm'>👍</span> : <ThumbsUp className='size-3.5' />}
                    {localUp > 0 && <span className='text-[12px] leading-none'>{localUp}</span>}
                  </button>
                  <button
                    type='button'
                    className={voteButtonClass}
                    onClick={() => handleVote(localVote === 'down' ? '' : 'down')}
                  >
                    {localVote === 'down' ? <span className='text-sm'>👎</span> : <ThumbsDown className='size-3.5' />}
                    {localDown > 0 && <span className='text-[12px] leading-none'>{localDown}</span>}
                  </button>
                </>
              ) : (
                <>
                  {localUp > 0 && (
                    <span className='inline-flex h-7 items-center justify-center gap-1.5 px-1.5 text-[12px] leading-none text-muted-foreground'>
                      <ThumbsUp className='size-3.5' />
                      {localUp}
                    </span>
                  )}
                  {localDown > 0 && (
                    <span className='inline-flex h-7 items-center justify-center gap-1.5 px-1.5 text-[12px] leading-none text-muted-foreground'>
                      <ThumbsDown className='size-3.5' />
                      {localDown}
                    </span>
                  )}
                </>
              )}
            </ActionPillSticky>
            {/* Action buttons - always visible on mobile, hover-reveal on desktop */}
            <ActionPillActions>
              {canReply && onReply && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      className={iconActionButtonClass}
                      aria-label={t`Reply`}
                      onClick={() => onReply(comment.id)}
                    >
                      <MessageSquare className='size-3.5' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t`Reply`}</TooltipContent>
                </Tooltip>
              )}
              {/* More menu (edit, delete, moderation, report) */}
              {(commentCanEdit || canModerate || onReport) && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type='button'
                          className={iconActionButtonClass}
                          aria-label={t`More options`}
                        >
                          <MoreHorizontal className='size-3.5' />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t`More options`}</TooltipContent>
                  </Tooltip>
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
                      <DropdownMenuItem onClick={() => setBanning(true)}>
                        <Ban className='me-2 size-4' />
                        <Trans>Ban author</Trans>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </ActionPillActions>
          </ActionPill>
      </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t`Delete comment`}
        desc={t`Are you sure you want to delete this comment? This will also delete all replies. This action cannot be undone.`}
        confirmText={t`Delete`}
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
        desc={t`This will hide the comment from regular users. Moderators can still see it and restore it later.`}
        confirmText={t`Remove`}
        handleConfirm={() => {
          onRemove?.(comment.id)
          setRemoving(false)
        }}
      />

      {/* Ban confirmation dialog */}
      <ConfirmDialog
        open={banning}
        onOpenChange={setBanning}
        title={t`Ban author`}
        desc={t`They will lose access to this forum. You can lift it later from the Restrictions tab.`}
        confirmText={t`Ban`}
        destructive={true}
        handleConfirm={() => {
          onBanAuthor?.(comment.member)
          setBanning(false)
        }}
      />

      {discardDialog}

      {/* Reply input */}
      {isReplying && (
        <CommentBox
          kind='reply'
          className='mt-2 border-t pt-2'
          value={replyValue}
          onValueChange={(value) => onReplyChange?.(value)}
          onSubmit={submitReply}
          onClose={requestCloseReply}
          onFilesChange={handleReplyFilesChange}
          onSearchPeople={onSearchPeople}
          progress={replyProgress}
          placeholder={t`Reply to ${comment.name}...`}
          autoFocus
        />
      )}
    </div>
  )

  const children = hasReplies ? (
    <>
      {comment.children.map((reply) => (
        <ThreadComment
          key={reply.id}
          comment={reply}
          onOpenAttachment={onOpenAttachment}
          onVote={onVote}
          canVote={canVote}
          canReply={canReply}
          onReply={onReply}
          replyingToId={replyingToId}
          replyValue={replyValue}
          onReplyChange={onReplyChange}
          onReplyFilesChange={onReplyFilesChange}
          onReplySubmit={onReplySubmit}
          replyProgress={replyProgress}
          onReplyCancel={onReplyCancel}
          canEdit={canEdit}
          onEdit={onEdit}
          onDelete={onDelete}
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
