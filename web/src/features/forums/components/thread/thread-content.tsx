import { useState, useEffect } from 'react'
import { ConfirmDialog, EntityAvatar, PostTitleBar, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useFormat, highlightMentions, renderMentions } from '@mochi/web'
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
import { embedVideos, sanitizeHtml } from '../../utils'

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
  }, [post.id])

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
  const voteButtonClass = 'text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:-m-1 md:min-h-0 md:rounded-none md:px-1 md:py-1'
  const iconActionButtonClass = 'text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:-m-1 md:size-auto md:rounded-none md:p-1'

  return (
    <div className='group/post space-y-4'>
      <PostTitleBar
        title={<h1>{post.title}</h1>}
        titleClassName={cn(isRemoved && 'opacity-60')}
        trailing={
          <>
            {isPending && (
              <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                <Clock className='size-3' />
                Pending approval
              </span>
            )}
            {isRemoved && (
              <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
                <EyeOff className='size-3' />
                Removed
              </span>
            )}
            {isLocked && (
              <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <Lock className='size-3' />
                Locked
              </span>
            )}
            {isPinned && (
              <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20 dark:text-primary'>
                <Pin className='size-3' />
                Pinned
              </span>
            )}
          </>
        }
        meta={
          <span className='inline-flex items-center gap-1.5'>
            {showForumBadge && forumName && <>{forumName} · </>}
            <EntityAvatar fingerprint={post.member} name={post.name} size={16} />
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
        <span className='inline-flex items-center gap-4 md:gap-3'>
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
                  <ThumbsUp className='size-4' />
                )}
                {localUp > 0 && localUp}
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
                  <ThumbsDown className='size-4' />
                )}
                {localDown > 0 && localDown}
              </button>
            </>
          ) : (
            <>
              {localUp > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <ThumbsUp className='size-4' />
                  {localUp}
                </span>
              )}
              {localDown > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <ThumbsDown className='size-4' />
                  {localDown}
                </span>
              )}
            </>
          )}
          {canReply && onReply && (
            <button
              type='button'
              className={iconActionButtonClass}
              onClick={(e) => {
                e.stopPropagation()
                onReply()
              }}
            >
              <MessageSquare className='size-4' />
            </button>
          )}
          {/* More menu (edit, delete, moderation, report) */}
          {(canEdit || canModerate || onReport) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type='button'
                  className={iconActionButtonClass}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className='size-4' />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                {canEdit && onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className='mr-2 size-4' />
                    Edit
                  </DropdownMenuItem>
                )}
                {canEdit && onDelete && (
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className='mr-2 size-4' />
                    Delete
                  </DropdownMenuItem>
                )}
                {canEdit && (canModerate || onReport) && <DropdownMenuSeparator />}
                {canModerate && (
                  <>
                    {isRemoved
                      ? onRestore && (
                          <DropdownMenuItem onClick={onRestore}>
                            <Eye className='mr-2 size-4' />
                            Restore
                          </DropdownMenuItem>
                        )
                      : onRemove && (
                          <DropdownMenuItem onClick={() => setRemoveDialogOpen(true)}>
                            <EyeOff className='mr-2 size-4' />
                            Remove
                          </DropdownMenuItem>
                        )}
                    {isLocked
                      ? onUnlock && (
                          <DropdownMenuItem onClick={onUnlock}>
                            <Unlock className='mr-2 size-4' />
                            Unlock
                          </DropdownMenuItem>
                        )
                      : onLock && (
                          <DropdownMenuItem onClick={onLock}>
                            <Lock className='mr-2 size-4' />
                            Lock
                          </DropdownMenuItem>
                        )}
                    {isPinned
                      ? onUnpin && (
                          <DropdownMenuItem onClick={onUnpin}>
                            <PinOff className='mr-2 size-4' />
                            Unpin
                          </DropdownMenuItem>
                        )
                      : onPin && (
                          <DropdownMenuItem onClick={onPin}>
                            <Pin className='mr-2 size-4' />
                            Pin
                          </DropdownMenuItem>
                        )}
                  </>
                )}
                {onReport && (
                  <DropdownMenuItem onClick={onReport}>
                    <Flag className='mr-2 size-4' />
                    Report
                  </DropdownMenuItem>
                )}
                {canModerate && (onMuteAuthor || onBanAuthor) && <DropdownMenuSeparator />}
                {canModerate && onMuteAuthor && (
                  <DropdownMenuItem onClick={onMuteAuthor}>
                    <VolumeX className='mr-2 size-4' />
                    Mute author
                  </DropdownMenuItem>
                )}
                {canModerate && onBanAuthor && (
                  <DropdownMenuItem onClick={onBanAuthor}>
                    <Ban className='mr-2 size-4' />
                    Ban author
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title='Delete post'
        desc='Are you sure you want to delete this post? This will also delete all comments. This action cannot be undone.'
        confirmText='Delete'
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
        title='Remove post'
        desc='This will hide the post from regular users. Moderators can still see it and restore it later.'
        confirmText='Remove'
        handleConfirm={() => {
          setRemoveDialogOpen(false)
          onRemove?.()
        }}
      />
    </div>
  )
}
