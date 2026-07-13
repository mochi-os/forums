// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useRef, useState, useEffect } from 'react'
import { Trans, useLingui, Plural } from '@lingui/react/macro'
import { Button, CommentTreeLayout, ConfirmDialog, EntityAvatar, MentionTextarea, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, useFormat, renderMentions, useImageObjectUrls, getAppPath, textUnchanged, type MentionUser, AttachmentGroup, Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction, pendingFileKey, removePendingFile } from '@mochi/web'
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
  const { t } = useLingui()
  const { formatFileSize } = useFormat()
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
  const commentCanEdit = canEdit?.(comment.member) ?? false
  const hasReplies = comment.children && comment.children.length > 0
  const hasVotes = localUp > 0 || localDown > 0
  /* eslint-disable lingui/no-unlocalized-strings -- Tailwind class names */
  const voteButtonClass = 'inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
  const iconActionButtonClass = 'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
  /* eslint-enable lingui/no-unlocalized-strings */

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
          <div className='comment-actions inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-sm transition-all rtl:flex-row-reverse'>
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
          {/* Action buttons - always visible on mobile, hover-reveal on desktop */}
          <div className='flex items-center gap-0.5 md:max-w-0 md:opacity-0 md:overflow-hidden md:group-hover/row:max-w-[200px] md:group-hover/row:opacity-100 md:group-focus-within/row:max-w-[200px] md:group-focus-within/row:opacity-100 md:has-[[data-state=open]]:max-w-[200px] md:has-[[data-state=open]]:opacity-100 transition-all duration-200'>
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

      {/* Reply input */}
      {isReplying && (
        <div className='mt-2 space-y-2 border-t pt-2'>
          <MentionTextarea
            placeholder={t`Reply to ${comment.name}...`}
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
            <AttachmentGroup>
              {replyFiles.map((file, i) => {
                const isImage = file.type.startsWith('image/')
                return (
                  <Attachment key={pendingFileKey(file)} state="uploading" size="sm">
                    <AttachmentMedia variant={isImage ? "image" : "icon"}>
                      {isImage && replyPreviewUrls[i] ? (
                        <img src={replyPreviewUrls[i] ?? undefined} alt={file.name} draggable={false} />
                      ) : (
                        <Paperclip />
                      )}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{file.name}</AttachmentTitle>
                      <AttachmentDescription>
                        {formatFileSize(file.size)}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction onClick={() => setReplyFiles((prev) => removePendingFile(prev, file))} aria-label={t`Remove file`}>
                        <X className='size-4' />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                )
              })}
            </AttachmentGroup>
          )}
          <div className='flex items-center justify-end gap-2'>
            <input
              ref={replyFileRef}
              type='file'
              multiple
              onChange={(e) => { if (e.target.files) { const f = Array.from(e.target.files); setReplyFiles((prev) => [...prev, ...f]) } e.target.value = '' }}
              className='hidden'
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type='button' variant='ghost' size='icon' className='size-8' onClick={() => replyFileRef.current?.click()} aria-label={t`Attach reply files`}>
                  <Paperclip className='size-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`Attach reply files`}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>{t`Cancel reply`}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>{t`Submit reply`}</TooltipContent>
            </Tooltip>
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
