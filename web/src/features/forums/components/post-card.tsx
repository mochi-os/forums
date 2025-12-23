import { Card, CardContent } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostAttachments } from './thread/post-attachments'

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  onSelect: (forumId: string, postId: string) => void
}

export function PostCard({ post, forumName, showForumBadge, onSelect }: PostCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 py-0"
      onClick={() => onSelect(post.forum, post.id)}
    >
      <CardContent className="p-4 space-y-2">
      {/* Title row with optional forum name */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold leading-tight">
          {post.title}
        </h3>
        {showForumBadge && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {forumName}
          </span>
        )}
      </div>

      {/* Body */}
      <p className="text-sm text-foreground line-clamp-2">{post.body}</p>

      {/* Attachments */}
      <PostAttachments attachments={post.attachments || []} forumId={post.forum} />

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {post.up > 0 && (
          <span className="flex items-center gap-1">
            <ThumbsUp className="size-3" />
            {post.up}
          </span>
        )}
        {post.down > 0 && (
          <span className="flex items-center gap-1">
            <ThumbsDown className="size-3" />
            {post.down}
          </span>
        )}
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3" />
          {getCommentCount(post.comments)}
        </span>
      </div>
      </CardContent>
    </Card>
  )
}
