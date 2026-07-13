// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { ConfirmDialog, EntityAvatar, PostTitleBar, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, useFormat, highlightMentions, renderMentions, getAppPath } from '@mochi/web'
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Pin,
  PinOff,
  Flag,
  EyeOff,
  Eye,
  Clock,
  VolumeX,
  Ban,
  MoreHorizontal,
} from 'lucide-react'
import type { Post, Attachment } from '@/api/types/posts'
import { PostAttachments } from './post-attachments'
import { PostTagsTooltip } from '../post-tags'
import { SavedButton } from '../saved-button'
import { embedVideos, sanitizeHtml } from '../../utils'
import { t } from '@lingui/core/macro'

interface ThreadContentProps {
  post: Post
  attachments?: Attachment[]
  server?: string
  forumName?: string
  showForumBadge?: boolean
  onVote: (vote: 'up' | 'down' | '') => void
  isVotePending: boolean
  canVote?: boolean
  canReply?: boolean
  onReply?: () => void
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
  // Tags
  canTag?: boolean
  isLoggedIn?: boolean
  onTagAdded?: (label: string) => Promise<void>
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
  onInterestRemove?: (qid: string) => void
  // Moderation
  canModerate?: boolean
  onRemove?: () => void
  onRestore?: () => void
  onLock?: () => void
  onUnlock?: () => void
  onPin?: () => void
  onUnpin?: () => void
  onReport?: () => void
  onMuteAuthor?: () => void
  onBanAuthor?: () => void
}

export function ThreadContent({
  post,
  attachments,
  server,
  forumName,
  showForumBadge = false,
  onVote,
  isVotePending: _isVotePending,
  canVote = true,
  canReply = true,
  onReply,
  canEdit = false,
  onEdit,
  onDelete,
  canTag = false,
  isLoggedIn = true,
  onTagAdded,
  onTagFilter,
  onInterestUp,
  onInterestDown,
  onInterestRemove,
  canModerate = false,
  onRemove,
  onRestore,
  onLock,
  onUnlock,
  onPin,
  onUnpin,
  onReport,
  onMuteAuthor,
  onBanAuthor,
}: ThreadContentProps) {
  const { formatTimestamp } = useFormat()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  // Local vote state to prevent re-render flicker
  const [localVote, setLocalVote] = useState(post.user_vote || '')
  const [localUp, setLocalUp] = useState(post.up)
  const [localDown, setLocalDown] = useState(post.down)

  // Sync from server when post changes (e.g., initial load)
  useEffect(() => {
    setLocalVote(post.user_vote || '')
    setLocalUp(post.up)
    setLocalDown(post.down)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.user_vote, post.up, post.down])

  const handleVote = (newVote: 'up' | 'down' | '') => {
    // Update local state immediately
    const prevVote = localVote
    if (prevVote === 'up') setLocalUp((v) => v - 1)
    if (prevVote === 'down') setLocalDown((v) => v - 1)
    if (newVote === 'up') setLocalUp((v) => v + 1)
    if (newVote === 'down') setLocalDown((v) => v + 1)
    setLocalVote(newVote)

    // Send to server
    onVote(newVote)
  }

  const isPending = post.status === 'pending'
  const isRemoved = post.status === 'removed'
  const isLocked = !!post.locked
  const isPinned = !!post.pinned
  const timestamp = formatTimestamp(post.created)
  /* eslint-disable lingui/no-unlocalized-strings -- Tailwind class names */
  const voteButtonClass = 'inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
  const iconActionButtonClass = 'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active'
  /* eslint-enable lingui/no-unlocalized-strings */

  return (
    <div className='group space-y-4'>
      <PostTitleBar
        title={<h1>{post.title}</h1>}
        titleClassName={cn(isRemoved && 'opacity-60')}
        trailing={
          <>
            {isPending && (
              <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                <Clock className='size-3' />
                <Trans>Pending approval</Trans>
              </span>
            )}
            {isRemoved && (
              <span className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'>
                <EyeOff className='size-3' />
                <Trans>Removed</Trans>
              </span>
            )}
            {isLocked && (
              <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <Lock className='size-3' />
                <Trans>Locked</Trans>
              </span>
            )}
            {isPinned && (
              <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20 dark:text-primary'>
                <Pin className='size-3' />
                <Trans>Pinned</Trans>
              </span>
            )}
          </>
        }
        meta={
          <span className='inline-flex items-center gap-1.5'>
            {showForumBadge && forumName && <>{forumName} · </>}
            <EntityAvatar
              src={`${getAppPath()}/${post.forum}/-/${post.id}/asset/avatar`}
              styleUrl={`${getAppPath()}/${post.forum}/-/${post.id}/asset/style`}
              seed={post.member}
              name={post.name}
              size="xs"
            />
            <span>{post.name}</span>
            <span> · </span>
            <span>{timestamp}{post.edited ? ' (edited)' : ''}</span>
          </span>
        }
      />

      {/* Post Body */}
      {post.body_markdown ? (
        <div
          className='prose prose-sm dark:prose-invert max-w-none text-foreground'
          dangerouslySetInnerHTML={{ __html: highlightMentions(embedVideos(sanitizeHtml(post.body_markdown))) }}
        />
      ) : (
        <div className='text-foreground max-w-none text-sm leading-relaxed'>
          <p className='text-foreground m-0 leading-relaxed whitespace-pre-wrap'>
            {renderMentions(post.body)}
          </p>
        </div>
      )}

      {/* Attachments */}
      <PostAttachments
        attachments={attachments || post.attachments || []}
        forumId={post.forum}
        server={server}
      />

      {/* Actions row */}
      <div className='text-muted-foreground flex items-center gap-3 text-sm'>
        {/* Tags */}
        {isLoggedIn && (
          <PostTagsTooltip
            tags={post.tags || []}
            onFilter={onTagFilter}
            onAdd={canTag && onTagAdded ? onTagAdded : undefined}
            onInterestUp={onInterestUp}
            onInterestDown={onInterestDown}
            onInterestRemove={onInterestRemove}
          />
        )}
        <div className='comment-actions inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-sm transition-all'>
          {/* Votes */}
          {canVote ? (
            <>
              <button
                type='button'
                className={voteButtonClass}
                onClick={(e) => {
                  e.stopPropagation()
                  handleVote(localVote === 'up' ? '' : 'up')
                }}
              >
                {localVote === 'up' ? (
                  <span className='text-sm'>👍</span>
                ) : (
                  <ThumbsUp className='size-3.5' />
                )}
                {localUp > 0 && <span className='text-[12px] leading-none'>{localUp}</span>}
              </button>
              <button
                type='button'
                className={voteButtonClass}
                onClick={(e) => {
                  e.stopPropagation()
                  handleVote(localVote === 'down' ? '' : 'down')
                }}
              >
                {localVote === 'down' ? (
                  <span className='text-sm'>👎</span>
                ) : (
                  <ThumbsDown className='size-3.5' />
                )}
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

          {/* Action buttons - always visible */}
          <div className='flex items-center gap-0.5'>
            {canReply && onReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    className={iconActionButtonClass}
                    aria-label={t`Reply`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onReply()
                    }}
                  >
                    <MessageSquare className='size-3.5' />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t`Reply`}</TooltipContent>
              </Tooltip>
            )}
            {/* Save for later */}
            {isLoggedIn && <SavedButton post={post} className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active" />}
            {/* More menu (edit, delete, moderation, report) */}
            {(canEdit || canModerate || onReport) && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type='button'
                        className={iconActionButtonClass}
                        aria-label={t`More options`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className='size-3.5' />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t`More options`}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align='start'>
                  {canEdit && onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className='me-2 size-4' />
                      <Trans>Edit</Trans>
                    </DropdownMenuItem>
                  )}
                  {canEdit && onDelete && (
                    <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className='me-2 size-4' />
                      <Trans>Delete</Trans>
                    </DropdownMenuItem>
                  )}
                  {canEdit && (canModerate || onReport) && <DropdownMenuSeparator />}
                  {canModerate && (
                    <>
                      {isRemoved
                        ? onRestore && (
                            <DropdownMenuItem onClick={onRestore}>
                              <Eye className='me-2 size-4' />
                              <Trans>Restore</Trans>
                            </DropdownMenuItem>
                          )
                        : onRemove && (
                            <DropdownMenuItem onClick={() => setRemoveDialogOpen(true)}>
                              <EyeOff className='me-2 size-4' />
                              <Trans>Remove</Trans>
                            </DropdownMenuItem>
                          )}
                      {isLocked
                        ? onUnlock && (
                            <DropdownMenuItem onClick={onUnlock}>
                              <Unlock className='me-2 size-4' />
                              <Trans>Unlock</Trans>
                            </DropdownMenuItem>
                          )
                        : onLock && (
                            <DropdownMenuItem onClick={onLock}>
                              <Lock className='me-2 size-4' />
                              <Trans>Lock</Trans>
                            </DropdownMenuItem>
                          )}
                      {isPinned
                        ? onUnpin && (
                            <DropdownMenuItem onClick={onUnpin}>
                              <PinOff className='me-2 size-4' />
                              <Trans>Unpin</Trans>
                            </DropdownMenuItem>
                          )
                        : onPin && (
                            <DropdownMenuItem onClick={onPin}>
                              <Pin className='me-2 size-4' />
                              <Trans>Pin</Trans>
                            </DropdownMenuItem>
                          )}
                    </>
                  )}
                  {onReport && (
                    <DropdownMenuItem onClick={onReport}>
                      <Flag className='me-2 size-4' />
                      <Trans>Report</Trans>
                    </DropdownMenuItem>
                  )}
                  {canModerate && (onMuteAuthor || onBanAuthor) && <DropdownMenuSeparator />}
                  {canModerate && onMuteAuthor && (
                    <DropdownMenuItem onClick={onMuteAuthor}>
                      <VolumeX className='me-2 size-4' />
                      <Trans>Mute author</Trans>
                    </DropdownMenuItem>
                  )}
                  {canModerate && onBanAuthor && (
                    <DropdownMenuItem onClick={onBanAuthor}>
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t`Delete post`}
        desc={t`Are you sure you want to delete this post? This will also delete all comments. This action cannot be undone.`}
        confirmText={t`Delete`}
        destructive={true}
        handleConfirm={() => {
          setDeleteDialogOpen(false)
          onDelete?.()
        }}
      />

      {/* Remove confirmation dialog */}
      <ConfirmDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title={t`Remove post`}
        desc={t`This will hide the post from regular users. Moderators can still see it and restore it later.`}
        confirmText={t`Remove`}
        handleConfirm={() => {
          setRemoveDialogOpen(false)
          onRemove?.()
        }}
      />
    </div>
  )
}
