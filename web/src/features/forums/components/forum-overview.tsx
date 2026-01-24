import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoadMoreTrigger, EmptyState, Button, toast } from '@mochi/common'
import { FileEdit, Rss, Plus, Hash, Loader2 } from 'lucide-react'
import { type Forum, type Post, type RecommendedForum } from '@/api/types/forums'
import { forumsApi } from '@/api/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'
import { InlineForumSearch } from './inline-forum-search'

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
  onOpenCreate?: () => void
  subscribedIds?: Set<string>
  recommendations?: RecommendedForum[]
  isLoadingRecommendations?: boolean
  isRecommendationsError?: boolean
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
  onOpenCreate,
  subscribedIds = new Set(),
  recommendations = [],
  isLoadingRecommendations = false,
  isRecommendationsError = false,
}: ForumOverviewProps) {
  const queryClient = useQueryClient()
  const [subscribedThisSession, setSubscribedThisSession] = useState<Set<string>>(new Set())
  const [pendingForumId, setPendingForumId] = useState<string | null>(null)

  const handleSubscribeRecommendation = async (forum: RecommendedForum) => {
    setPendingForumId(forum.id)
    try {
      await forumsApi.subscribe(forum.id)
      setSubscribedThisSession((prev) => new Set(prev).add(forum.id))
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      toast.success('Subscribed', {
        description: `You are now subscribed to ${forum.name}.`,
      })
    } catch (error) {
      toast.error('Failed to subscribe', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setPendingForumId(null)
    }
  }

  // Filter out recommendations that user has already subscribed to this session
  const filteredRecommendations = recommendations.filter(
    (r) => !subscribedThisSession.has(r.id)
  )

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
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Rss className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="text-muted-foreground mb-1 text-sm font-medium">Forums</p>
            <p className="text-muted-foreground mb-4 max-w-sm text-xs">
              You have no forums yet.
            </p>
            <InlineForumSearch subscribedIds={subscribedIds} />
            {onOpenCreate && (
              <Button variant="outline" onClick={onOpenCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create a new forum
              </Button>
            )}

            {/* Recommendations Section */}
            <hr className="my-6 w-full max-w-md border-t" />
            <div className="w-full max-w-md">
              <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                Recommended forums
              </p>
              {isLoadingRecommendations ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                </div>
              ) : isRecommendationsError ? (
                <p className="text-muted-foreground text-sm">
                  Unable to connect to the recommendations service
                </p>
              ) : filteredRecommendations.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No recommendations available
                </p>
              ) : (
                <div className="divide-border divide-y rounded-lg border text-left">
                  {filteredRecommendations.map((rec) => {
                    const isPending = pendingForumId === rec.id

                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                            <Hash className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{rec.name}</span>
                            {rec.blurb && (
                              <span className="text-muted-foreground truncate text-xs">
                                {rec.blurb}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSubscribeRecommendation(rec)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Subscribe'
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
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
