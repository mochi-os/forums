import { LoadMoreTrigger, EmptyState } from '@mochi/common'
import { MessageSquare, FileEdit } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  server?: string
  onSelectPost: (forumId: string, postId: string) => void
  onCreatePost: (data: {
    forum: string
    title: string
    body: string
    attachments?: File[]
  }) => void
  isCreatingPost?: boolean
  isPostCreated?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function ForumOverview({
  forum,
  posts,
  server,
  onSelectPost,
  onCreatePost,
  isCreatingPost = false,
  isPostCreated = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ForumOverviewProps) {
  if (!forum) {
    // All forums view - show each post in its own card with forum badge
    return (
      <div className='space-y-3'>
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={post.forumName || 'Unknown'}
              showForumBadge={true}
              server={server}
              onSelect={onSelectPost}
              variant='card'
            />
          ))
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description="Subscribe to forums or create your own to see posts"
          />
        )}
      </div>
    )
  }

  // Selected forum view
  return (
    <div className='space-y-6'>
      {posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={forum.name}
              showForumBadge={false}
              server={server}
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

        <EmptyState
          icon={FileEdit}
          title="No posts in this forum yet"
          description={!forum.can_post ? "Check back later for new content" : undefined}
        >
          {forum.can_post && (
            <CreatePostDialog
              forumId={forum.id}
              forumName={forum.name}
              onCreate={onCreatePost}
              isPending={isCreatingPost}
              isSuccess={isPostCreated}
            />
          )}
        </EmptyState>
      )}
    </div>
  )
}
