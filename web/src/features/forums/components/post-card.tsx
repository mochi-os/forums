import { Card, CardContent } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostAttachments } from './thread/post-attachments'

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  server?: string
  onSelect: (forumId: string, postId: string) => void
}

export function PostCard({
  post,
  forumName,
  showForumBadge,
  server,
  onSelect,
}: PostCardProps) {
  return (
    <Card
      className='hover:border-primary/30 cursor-pointer py-0 transition-all hover:shadow-md'
      onClick={() => onSelect(post.forum, post.id)}
    >
      <CardContent className='space-y-2 p-4'>
        {/* Title row with optional forum name */}
        <div className='flex items-start justify-between gap-4'>
          <h3 className='text-base leading-tight font-semibold'>
            {post.title}
          </h3>
          {showForumBadge && (
            <span className='text-muted-foreground text-xs whitespace-nowrap'>
              {forumName}
            </span>
          )}
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
      </CardContent>
    </Card>
  )
}
