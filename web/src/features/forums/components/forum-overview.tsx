import { LoadMoreTrigger, EmptyState, Button, CardSkeleton, EntityOnboardingEmptyState } from '@mochi/common'
import { MessageSquare, FileEdit, Plus } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'
import { InlineForumSearch } from './inline-forum-search'
import { RecommendedForums } from './recommended-forums'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  server?: string
  subscribedIds?: Set<string>
  onSelectPost: (forumId: string, postId: string) => void
  onTagRemoved?: (forumId: string, postId: string, tagId: string) => void
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
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
  onTagRemoved,
  onTagFilter,
  onInterestUp,
  onInterestDown,
}: ForumOverviewProps) {

  if (!forum) {
    // All forums view - show each post in its own card with forum badge
    return (
      <div className='space-y-4'>
        {isLoading ? (
          <CardSkeleton count={3} />
        ) : posts.length > 0 ? (
          <div className='space-y-3'>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                forumName={post.forumName || 'Unknown'}
                showForumBadge={true}
                server={server}
                onSelect={onSelectPost}
                onTagRemoved={(tagId) => onTagRemoved?.(post.forum, post.id, tagId)}
                onTagFilter={onTagFilter}
                onInterestUp={onInterestUp}
                onInterestDown={onInterestDown}
                variant='card'
              />
            ))}
          </div>
        ) : (
          <EntityOnboardingEmptyState
            icon={MessageSquare}
            title='Forums'
            description='You have no forums yet.'
            searchSlot={<InlineForumSearch subscribedIds={subscribedIds} />}
            primaryActionSlot={(
              <Button variant="outline" onClick={onCreateForum}>
                <Plus className="mr-2 h-4 w-4" />
                Create a new forum
              </Button>
            )}
            secondarySlot={<RecommendedForums subscribedIds={subscribedIds} />}
          />
        )}
      </div>
    )
  }

  // Selected forum view
  return (
    <div className='space-y-6'>
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : posts.length > 0 ? (
        <>
          <div className='space-y-3'>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                forumName={forum.name}
                showForumBadge={false}
                server={server}
                onSelect={onSelectPost}
                onTagRemoved={(tagId) => onTagRemoved?.(post.forum, post.id, tagId)}
                onTagFilter={onTagFilter}
                onInterestUp={onInterestUp}
                onInterestDown={onInterestDown}
              />
            ))}
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
