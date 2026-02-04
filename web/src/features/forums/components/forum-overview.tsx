import { LoadMoreTrigger, EmptyState, SortSelector, type SortType, ViewSelector, type ViewMode, Button, CardSkeleton, ListSkeleton } from '@mochi/common'
import { MessageSquare, FileEdit, Plus, Search } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'
import { PostCardRow } from './post-card-row'
import { useLocalStorage } from '@/hooks/use-local-storage'

import { RecommendedForums } from './recommended-forums'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  server?: string
  subscribedIds?: Set<string>
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
  sort?: SortType
  onSortChange?: (sort: SortType) => void
  onFindForums?: () => void
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
  sort,
  onSortChange,
  onFindForums,
  onCreateForum,
  subscribedIds: _subscribedIds = new Set(),
}: ForumOverviewProps) {
  // View mode state
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    'forums-view-mode',
    'card'
  )

  if (!forum) {
    // All forums view - show each post in its own card with forum badge
    return (
      <div className='space-y-4'>
        {/* View Toggle */}
        {posts.length > 0 && (
          <div className='flex items-center justify-end gap-2'>
            <div className='hidden'>
              {sort && onSortChange && (
                <SortSelector value={sort} onValueChange={onSortChange} />
              )}
            </div>
            <ViewSelector value={viewMode} onValueChange={setViewMode} />
          </div>
        )}

        {isLoading ? (
          viewMode === 'card' ? (
            <CardSkeleton count={3} />
          ) : (
            <ListSkeleton count={5} />
          )
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
          <div className='flex flex-col gap-12 max-w-4xl mx-auto w-full pt-8'>
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <div className="mx-auto bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">No forums yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Search for forums to subscribe to, or create your own to get started.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button onClick={onCreateForum} className="rounded-full">
                  <Plus className='size-5' />
                  Create forum
                </Button>

                <Button
                  variant="outline"
                  onClick={onFindForums}
                  className="rounded-full text-muted-foreground hover:text-foreground shadow-sm"
                >
                  <Search className='size-4' />
                  Find forums
                </Button>
              </div>
            </div>

            <RecommendedForums onSubscribe={onFindForums} />
          </div>
        )}
      </div>
    )
  }

  // Selected forum view
  return (
    <div className='space-y-6'>
      {/* View Toggle */}
      <div className='flex items-center justify-end gap-2'>
        <div className='hidden'>
          {sort && onSortChange && (
            <SortSelector value={sort} onValueChange={onSortChange} />
          )}
        </div>
        <ViewSelector value={viewMode} onValueChange={setViewMode} />
      </div>

      {isLoading ? (
        viewMode === 'card' ? (
          <CardSkeleton count={3} />
        ) : (
          <ListSkeleton count={5} />
        )
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
