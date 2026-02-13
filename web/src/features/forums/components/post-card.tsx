import { Link } from '@tanstack/react-router'
import { Card, CardContent, cn, formatTimestamp } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostAttachments } from './thread/post-attachments'
interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  server?: string
  onSelect: (forumId: string, postId: string) => void
  variant?: 'card' | 'list-item'
}

export function PostCard({
  post,
  forumName,
  showForumBadge,
  server,
  onSelect,
  variant = 'card',
}: PostCardProps) {
  const timestamp = formatTimestamp(post.created)

  const content = (
    <div className='relative space-y-3 p-4'>
      {/* Metadata - top right, visible on hover */}
      <span className='text-muted-foreground absolute right-4 top-4 text-xs opacity-0 transition-opacity group-hover/card:opacity-100'>
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
            <span className='inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200'>
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
      <div className='text-muted-foreground flex items-center gap-1 text-xs'>
        {/* Upvote/Downvote counts - display only */}
        {post.up > 0 && (
          <span className='inline-flex items-center gap-1'>
            <ThumbsUp className='size-3' />
            {post.up}
          </span>
        )}
        {post.down > 0 && (
          <span className='inline-flex items-center gap-1'>
            <ThumbsDown className='size-3' />
            {post.down}
          </span>
        )}
        
        {/* Upvote button */}
        <button
          type='button'
          className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <ThumbsUp className='size-3' />
          <span>Upvote</span>
        </button>
        
        {/* Downvote button */}
        <button
          type='button'
          className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <ThumbsDown className='size-3' />
          <span>Downvote</span>
        </button>
        
        {/* Comments navigation link */}
        <Link
          to='/$forum/$post'
          params={{ forum: post.forum, post: post.id }}
          search={showForumBadge ? { from: 'all' } : undefined}
          className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare className='size-3' />
          <span>{getCommentCount(post.comments)}</span>
        </Link>
      </div>
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
