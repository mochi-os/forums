import { Card, CardContent } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { type Post } from '@/api/types/forums'
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
      {/* Meta row: Date & Forum Name */}
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <span className='capitalize'>{timeAgo}</span>
        {showForumBadge && (
          <>
            <span>•</span>
            <span>{forumName}</span>
          </>
        )}
      </div>

      {/* Title */}
      <h3 className='text-base leading-tight font-semibold'>{post.title}</h3>

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
