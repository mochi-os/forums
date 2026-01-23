import { LoadMoreTrigger, EmptyState, Skeleton, Card, CardContent } from '@mochi/common'
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
  isLoading?: boolean
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
  isLoading = false,
}: ForumOverviewProps) {
  if (!forum) {
    // All forums view - show each post in its own card with forum badge
    return (
      <div className='space-y-3'>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className='p-4'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Skeleton className='h-5 w-1/3' />
                    <Skeleton className='h-4 w-20' />
                  </div>
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-2/3' />
                </div>
              </CardContent>
            </Card>
          ))
        ) : posts.length > 0 ? (
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
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
             <div key={i} className="flex gap-4 p-4 border rounded-lg">
                <div className="flex-col flex items-center gap-2">
                   <Skeleton className="h-4 w-8" /> 
                   <Skeleton className="h-4 w-8" />
                </div>
                 <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2 pt-2">
                       <Skeleton className="h-6 w-20" />
                       <Skeleton className="h-6 w-20" />
                    </div>
                 </div>
             </div>
          ))}
        </div>
      ) : posts.length > 0 ? (
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
