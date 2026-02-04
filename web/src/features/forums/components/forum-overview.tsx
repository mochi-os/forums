import { LoadMoreTrigger, EmptyState, Skeleton, Card, CardContent, type ViewMode, Button } from '@mochi/common'
import { MessageSquare, FileEdit, Plus } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'
import { PostCardRow } from './post-card-row'
import { InlineForumSearch } from './inline-forum-search'
import { RecommendedForums } from './recommended-forums'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  server?: string
  subscribedIds?: Set<string>
  viewMode?: ViewMode
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
  onCreateForum?: () => void
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
  onCreateForum,
  subscribedIds = new Set(),
  viewMode = 'card',
}: ForumOverviewProps) {

  if (!forum) {
    // All forums view - show each post in its own card with forum badge
    return (
      <div className='space-y-4'>
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
          <div className='space-y-3'>
            {posts.map((post) =>
              viewMode === 'card' ? (
                <PostCard
                  key={post.id}
                  post={post}
                  forumName={post.forumName || 'Unknown'}
                  showForumBadge={true}
                  server={server}
                  onSelect={onSelectPost}
                  variant='card'
                />
              ) : (
                <PostCardRow
                  key={post.id}
                  post={post}
                  forumName={post.forumName || 'Unknown'}
                  showForumBadge={true}
                  onSelect={onSelectPost}
                />
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="text-muted-foreground mb-1 text-sm font-medium">Forums</p>
            <p className="text-muted-foreground mb-4 max-w-sm text-xs">
              You have no forums yet.
            </p>
            <InlineForumSearch subscribedIds={subscribedIds} />
            <Button variant="outline" onClick={onCreateForum} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create a new forum
            </Button>
            <RecommendedForums subscribedIds={subscribedIds} />
          </div>
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
          <div className='space-y-3'>
            {posts.map((post) =>
              viewMode === 'card' ? (
                <PostCard
                  key={post.id}
                  post={post}
                  forumName={forum.name}
                  showForumBadge={false}
                  server={server}
                  onSelect={onSelectPost}
                />
              ) : (
                <PostCardRow
                  key={post.id}
                  post={post}
                  forumName={forum.name}
                  showForumBadge={false}
                  onSelect={onSelectPost}
                />
              )
            )}
          </div>
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
