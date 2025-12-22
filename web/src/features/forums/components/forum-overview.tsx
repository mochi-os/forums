import {
  Card,
  CardContent,
  LoadMoreTrigger,
} from '@mochi/common'
import { MessageSquare, FileEdit } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { PostCard } from './post-card'
import { CreatePostDialog } from './create-post-dialog'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  onSelectPost: (forumId: string, postId: string) => void
  onCreatePost: (data: { forum: string; title: string; body: string; attachments?: File[] }) => void
  isCreatingPost?: boolean
  isPostCreated?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function ForumOverview({
  forum,
  posts,
  onSelectPost,
  onCreatePost,
  isCreatingPost = false,
  isPostCreated = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ForumOverviewProps) {
  if (!forum) {
    // All forums view - use forumName from post object (set by parent)
    return (
      <div className="space-y-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={post.forumName || 'Unknown'}
              showForumBadge={true}
              onSelect={onSelectPost}
            />
          ))
        ) : (
          <Card className="shadow-md">
            <CardContent className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <MessageSquare className="size-10 text-primary" />
              </div>
              <p className="text-sm font-semibold">No posts yet</p>
              <p className="text-sm text-muted-foreground">
                Subscribe to forums or create your own to see posts
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Selected forum view
  return (
    <div className="space-y-6">
      {posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={forum.name}
              showForumBadge={false}
              onSelect={onSelectPost}
            />
          ))}
          {onLoadMore && (
            <LoadMoreTrigger
              hasMore={hasNextPage}
              isLoading={isFetchingNextPage}
              onLoadMore={onLoadMore}
            />
          )}
        </>
      ) : (
        <Card className="shadow-md">
          <CardContent className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <FileEdit className="size-10 text-primary" />
            </div>
            <p className="text-sm font-semibold">No posts in this forum yet</p>
            <p className="text-sm text-muted-foreground">
              {forum.can_post
                ? 'Be the first to start a conversation'
                : 'Check back later for new content'}
            </p>
            {forum.can_post && (
              <div className="mt-2">
                <CreatePostDialog
                  forumId={forum.id}
                  forumName={forum.name}
                  onCreate={onCreatePost}
                  isPending={isCreatingPost}
                  isSuccess={isPostCreated}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
