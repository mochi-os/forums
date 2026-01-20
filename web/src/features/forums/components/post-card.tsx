import { Card, CardContent } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostAttachments } from './thread/post-attachments'
import { cn } from '@mochi/common'
import { formatDistanceToNow } from 'date-fns'

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
  const dateParams = { addSuffix: true }
  const timeAgo = formatDistanceToNow(new Date(post.created * 1000), dateParams)

  const content = (
    <div className='space-y-2 p-4'>
      {/* Title row with badges */}
      <div className='flex items-start justify-between gap-4'>
        <h3 className='text-base leading-tight font-semibold'>
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
          {showForumBadge && (
            <span className='text-muted-foreground text-xs whitespace-nowrap'>
              {forumName}
            </span>
          )}
        </div>
      </div>

      {/* Meta row: Date */}
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <span className='capitalize'>{timeAgo}</span>
      </div>

      {/* Body */}
      <p className='text-foreground line-clamp-2 text-sm'>{post.body}</p>

      {/* Attachments */}
      <PostAttachments
        attachments={post.attachments || []}
        forumId={post.forum}
        server={server}
      />

      {/* Stats row */}
      <div className='text-muted-foreground flex items-center gap-4 text-xs'>
        {post.up > 0 && (
          <span className='flex items-center gap-1'>
            <ThumbsUp className='size-3' />
            {post.up}
          </span>
        )}
        {post.down > 0 && (
          <span className='flex items-center gap-1'>
            <ThumbsDown className='size-3' />
            {post.down}
          </span>
        )}
        <span className='flex items-center gap-1'>
          <MessageSquare className='size-3' />
          {getCommentCount(post.comments)}
        </span>
      </div>
    </div>
  )

  if (variant === 'list-item') {
    return (
      <div
        className={cn(
          'hover:bg-accent/50 cursor-pointer transition-colors'
        )}
        onClick={() => onSelect(post.forum, post.id)}
      >
        {content}
      </div>
    )
  }

  return (
    <Card
      className='hover:border-primary/30 cursor-pointer py-0 transition-all hover:shadow-md'
      onClick={() => onSelect(post.forum, post.id)}
    >
      <CardContent className='p-0'>{content}</CardContent>
    </Card>
  )
}
