import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@mochi/common'
import { ThumbsUp, ThumbsDown, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { PostAttachments } from './post-attachments'
import type { Post, Attachment } from '@/api/types/posts'

interface ThreadContentProps {
  post: Post
  attachments?: Attachment[]
  server?: string
  onVote: (vote: 'up' | 'down' | '') => void
  isVotePending: boolean
  canVote?: boolean
  canReply?: boolean
  onReply?: () => void
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function ThreadContent({
  post,
  attachments,
  server,
  onVote,
  isVotePending: _isVotePending,
  canVote: _canVote = true,
  canReply = true,
  onReply,
  canEdit = false,
  onEdit,
  onDelete,
}: ThreadContentProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
    if (prevVote === 'up') setLocalUp(v => v - 1)
    if (prevVote === 'down') setLocalDown(v => v - 1)
    if (newVote === 'up') setLocalUp(v => v + 1)
    if (newVote === 'down') setLocalDown(v => v + 1)
    setLocalVote(newVote)

    // Send to server
    onVote(newVote)
  }

  return (
    <div className="group/post space-y-4">
      {/* Header: Title and author/timestamp */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold leading-tight text-foreground">
          {post.title}
        </h1>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {post.name} · {post.created_local}
          {post.edited ? ' (edited)' : ''}
        </span>
      </div>

      {/* Post Body */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-foreground leading-relaxed whitespace-pre-wrap m-0">
          {post.body}
        </p>
      </div>

      {/* Attachments */}
      <PostAttachments attachments={attachments || post.attachments || []} forumId={post.forum} server={server} />

      {/* Actions row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {/* Vote counts */}
        {localUp > 0 && (
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-3" />
            {localUp}
          </span>
        )}
        {localDown > 0 && (
          <span className="inline-flex items-center gap-1">
            <ThumbsDown className="size-3" />
            {localDown}
          </span>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          style={localVote === 'up' ? { color: 'hsl(var(--primary))' } : undefined}
          onClick={(e) => {
            e.stopPropagation()
            handleVote(localVote === 'up' ? '' : 'up')
          }}
        >
          <ThumbsUp className="size-3" />
          <span>Upvote</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          style={localVote === 'down' ? { color: 'hsl(var(--primary))' } : undefined}
          onClick={(e) => {
            e.stopPropagation()
            handleVote(localVote === 'down' ? '' : 'down')
          }}
        >
          <ThumbsDown className="size-3" />
          <span>Downvote</span>
        </button>
        {canReply && onReply && (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onReply()
            }}
          >
            <MessageSquare className="size-3" />
            Reply
          </button>
        )}
        {canEdit && onEdit && onDelete && (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Pencil className="size-3" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete post"
        desc="Are you sure you want to delete this post? This will also delete all comments. This action cannot be undone."
        confirmText="Delete"
        handleConfirm={() => {
          setDeleteDialogOpen(false)
          onDelete?.()
        }}
      />
    </div>
  )
}
