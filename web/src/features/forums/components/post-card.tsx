import { Link } from '@tanstack/react-router'
import { Card, CardContent, cn, formatTimestamp } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostAttachments } from './thread/post-attachments'
import { PostTagsTooltip } from './post-tags'

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  server?: string
  onSelect: (forumId: string, postId: string) => void
  onTagRemoved?: (tagId: string) => void
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
  variant?: 'card' | 'list-item'
}

export function PostCard({
  post,
  forumName,
  showForumBadge,
  server,
  onSelect,
  onTagRemoved,
  onTagFilter,
  onInterestUp,
  onInterestDown,
  variant = 'card',
}: PostCardProps) {
  const timestamp = formatTimestamp(post.created)

  const content = (
    <div className='relative space-y-3 p-4'>
      {/* Metadata - top right, visible on hover */}
      <div className='absolute right-4 top-4 opacity-0 transition-opacity group-hover/card:opacity-100'>
        <span className='text-muted-foreground text-xs'>
          {showForumBadge ? (
            <>
              {forumName}
              <span> · </span>
            </>
          ) : null}
          {post.name}
          <span> · </span>
          {timestamp}
        </span>
      </div>

      {/* Title row with badges */}
      <div className='flex items-start justify-between gap-4'>
        <h3 className='pr-32 text-base leading-tight font-semibold'>
          {post.title}
        </h3>
        <div className='flex items-center gap-2'>
          {post.status === 'pending' && (
            <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
              <Clock className='size-3' />
              Pending
            </span>
          )}
          {post.status === 'removed' && (
            <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
              <EyeOff className='size-3' />
              Removed
            </span>
          )}
          {!!post.locked && (
            <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
              <Lock className='size-3' />
            </span>
          )}
          {!!post.pinned && (
            <span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
              <Pin className='size-3' />
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <p className='text-foreground line-clamp-2 text-sm'>{post.body}</p>

      {/* Attachments */}
      <PostAttachments
        attachments={post.attachments || []}
        forumId={post.forum}
        server={server}
      />

      {/* Action buttons row - interactive */}
      {((post.tags && post.tags.length > 0) || post.up > 0 || post.down > 0 || getCommentCount(post.comments) > 0) && (
        <div className='text-muted-foreground flex items-center gap-3 text-xs'>
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <PostTagsTooltip tags={post.tags} onRemove={onTagRemoved} onFilter={onTagFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} />
          )}

          {/* Upvote count */}
          {(post.up > 0 || post.user_vote === 'up') && (
            <span className='inline-flex items-center gap-1'>
              {post.user_vote === 'up' ? <span className='text-sm'>👍</span> : <ThumbsUp className='size-4' />}
              {post.up > 0 && post.up}
            </span>
          )}

          {/* Downvote count */}
          {(post.down > 0 || post.user_vote === 'down') && (
            <span className='inline-flex items-center gap-1'>
              {post.user_vote === 'down' ? <span className='text-sm'>👎</span> : <ThumbsDown className='size-4' />}
              {post.down > 0 && post.down}
            </span>
          )}

          {/* Comments navigation link */}
          {getCommentCount(post.comments) > 0 && (
            <Link
              to='/$forum/$post'
              params={{ forum: post.forum, post: post.id }}
              search={showForumBadge ? { from: 'all' } : undefined}
              className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors'
              onClick={(e) => e.stopPropagation()}
            >
              <MessageSquare className='size-3' />
              <span>{getCommentCount(post.comments)}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )

  if (variant === 'list-item') {
    return (
      <div
        className={cn(
          'group/card hover:bg-accent/50 cursor-pointer transition-colors'
        )}
        onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
      >
        {content}
      </div>
    )
  }

  return (
    <Card
      className='group/card hover:border-primary/30 cursor-pointer py-0 transition-all hover:shadow-md'
      onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
    >
      <CardContent className='p-0'>{content}</CardContent>
    </Card>
  )
}
