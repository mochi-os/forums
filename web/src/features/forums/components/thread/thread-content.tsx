import { useState, useEffect } from 'react'
import {
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
import type { Post, Attachment, Tag } from '@/api/types/posts'
import { PostAttachments } from './post-attachments'
import { PostTags } from '../post-tags'
import { TagInput } from '../tag-input'
import { formatTimestamp } from '@mochi/common'

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
  onTagAdded?: (tag: Tag) => void
  onTagRemoved?: (tagId: string) => void
  onTagFilter?: (label: string) => void
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
  onTagAdded,
  onTagRemoved,
  onTagFilter,
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

  return (
    <div className='group/post space-y-4'>
      {/* Status badges */}
      {(isPending || isRemoved || isLocked || isPinned) && (
        <div className='flex flex-wrap gap-2'>
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
            <span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
              <Pin className='size-3' />
              Pinned
            </span>
          )}
        </div>
      )}

      {/* Header: Title and author/timestamp */}
      <div className='relative'>
        {/* Metadata - top right, visible on hover */}
        <span className='text-muted-foreground absolute right-0 top-0 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover/post:opacity-100'>
          {showForumBadge && forumName && <>{forumName} · </>}
          {post.name} · {formatTimestamp(post.created)}
          {post.edited ? ' (edited)' : ''}
        </span>
        <h1 className={cn(
          'text-foreground pr-36 text-xl leading-tight font-semibold',
          isRemoved && 'opacity-60'
        )}>
          {post.title}
        </h1>
      </div>

      {/* Post Body */}
      {post.body_markdown ? (
        <div
          className='prose prose-sm dark:prose-invert max-w-none'
          dangerouslySetInnerHTML={{ __html: post.body_markdown }}
        />
      ) : (
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          <p className='text-foreground m-0 leading-relaxed whitespace-pre-wrap'>
            {post.body}
          </p>
        </div>
      )}

      {/* Attachments */}
      <PostAttachments
        attachments={attachments || post.attachments || []}
        forumId={post.forum}
        server={server}
      />

      {/* Tags */}
      {((post.tags && post.tags.length > 0) || canTag) && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <PostTags
            tags={post.tags || []}
            canManage={canTag}
            onRemove={onTagRemoved}
            onFilter={onTagFilter}
          />
          {canTag && onTagAdded && (
            <TagInput
              forumId={post.fingerprint ?? post.forum}
              postId={post.id}
              existingLabels={(post.tags || []).map((t) => t.label)}
              onAdded={onTagAdded}
            />
          )}
        </div>
      )}

      {/* Actions row */}
      <div className='text-muted-foreground flex items-center gap-1 text-xs'>
        {/* Vote counts */}
        {localUp > 0 && (
          <span className='inline-flex items-center gap-1'>
            <ThumbsUp className='size-3' />
            {localUp}
          </span>
        )}
        {localDown > 0 && (
          <span className='inline-flex items-center gap-1'>
            <ThumbsDown className='size-3' />
            {localDown}
          </span>
        )}
        {canVote && (
          <>
            <button
              type='button'
              className='text-foreground bg-surface-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-interactive-hover active:bg-interactive-active'
              style={
                localVote === 'up'
                  ? { color: 'hsl(var(--primary))' }
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation()
                handleVote(localVote === 'up' ? '' : 'up')
              }}
            >
              <ThumbsUp className='size-3' />
              <span>Upvote</span>
            </button>
            <button
              type='button'
              className='text-foreground bg-surface-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-interactive-hover active:bg-interactive-active'
              style={
                localVote === 'down'
                  ? { color: 'hsl(var(--primary))' }
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation()
                handleVote(localVote === 'down' ? '' : 'down')
              }}
            >
              <ThumbsDown className='size-3' />
              <span>Downvote</span>
            </button>
          </>
        )}
        {canReply && onReply && (
          <button
            type='button'
            className='text-foreground bg-surface-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-interactive-hover active:bg-interactive-active'
            onClick={(e) => {
              e.stopPropagation()
              onReply()
            }}
          >
            <MessageSquare className='size-3' />
            Reply
          </button>
        )}
        {/* More menu (edit, delete, moderation, report) */}
        {(canEdit || canModerate || onReport) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                className='text-foreground bg-surface-2 hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-interactive-hover active:bg-interactive-active'
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
