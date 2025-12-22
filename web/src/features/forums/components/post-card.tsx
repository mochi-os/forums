import {
  Card,
  CardContent,
  FacelessAvatar,
  Badge,
} from '@mochi/common'
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Hash,
} from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  onSelect: (forumId: string, postId: string) => void
}

export function PostCard({ post, forumName, showForumBadge, onSelect }: PostCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
      onClick={() => onSelect(post.forum, post.id)}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          {/* Forum tag (only show when viewing all forums) */}
          {showForumBadge && (
            <Badge variant="secondary" className="w-fit text-xs">
              <Hash className="size-3 mr-1" />
              {forumName}
            </Badge>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold leading-tight group-hover:underline transition-all decoration-primary/50 underline-offset-4">
            {post.title}
          </h3>

          {/* Body excerpt */}
          <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              <FacelessAvatar name={post.name} size={32} className="text-xs" />
              <div>
                <p className="text-sm font-medium">{post.name}</p>
                <p className="text-xs text-muted-foreground">{post.created_local}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageSquare className="size-4" />
                <span>{getCommentCount(post.comments)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="size-4" />
                <span>{post.up}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="size-4" />
                <span>{post.down}</span>
              </div>
              <ChevronRight className="size-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
