import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import { Main, usePageTitle } from '@mochi/common'
import { useForumsStore } from '@/stores/forums-store'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useSubscribeForum,
  useUnsubscribeForum,
  selectForums,
} from '@/hooks/use-forums-queries'
import { useInfinitePosts } from '@/hooks/use-infinite-posts'
import { ForumOverview } from '@/features/forums/components/forum-overview'

const searchSchema = z.object({
  server: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  component: ForumPage,
})

function ForumPage() {
  const navigate = useNavigate()
  const { forum: forumId } = Route.useParams()
  const { server: serverFromUrl } = Route.useSearch()

  // Get cached forum info (from probe/search results) as fallback
  const getCachedRemoteForum = useForumsStore(
    (state) => state.getCachedRemoteForum
  )
  const cachedForum = getCachedRemoteForum(forumId)

  // Use server from URL if available, otherwise fall back to cached
  const server = serverFromUrl ?? cachedForum?.server

  // Sidebar context for state sync
  const { setForum, setSubscription, subscribeHandler, unsubscribeHandler } =
    useSidebarContext()

  // Sync forum ID to sidebar context
  useEffect(() => {
    setForum(forumId)
    return () => setForum(null)
  }, [forumId, setForum])

  // Queries
  const { data: forumsData } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])

  // Infinite posts query for selected forum
  const {
    posts: infinitePosts,
    forum: selectedForum,
    isLoading: isLoadingForum,
    isError: isForumError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfinitePosts({ forum: forumId, server })
  const selectedForumPosts = infinitePosts.filter(
    (p) => 'title' in p && p.title
  )

  // Set page title
  usePageTitle(selectedForum?.name ?? 'Forum')

  // Mutations
  const createPostMutation = useCreatePost(forumId)
  const subscribeMutation = useSubscribeForum()
  const unsubscribeMutation = useUnsubscribeForum(() => {
    navigate({ to: APP_ROUTES.HOME })
  })

  // Register subscribe/unsubscribe handlers with sidebar
  useEffect(() => {
    subscribeHandler.current = () => subscribeMutation.mutate(forumId)
    unsubscribeHandler.current = () => unsubscribeMutation.mutate(forumId)

    // Update subscription state for sidebar
    const forum = forums.find((f) => f.id === forumId)
    setSubscription({
      isRemote: !forum,
      isSubscribed: !!forum,
      canUnsubscribe: !!forum && !forum.can_manage,
    })

    return () => {
      subscribeHandler.current = null
      unsubscribeHandler.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forumId, forums, setSubscription])

  const handleCreatePost = (data: {
    title: string
    body: string
    attachments?: File[]
  }) => {
    createPostMutation.mutate({
      forum: forumId,
      ...data,
    })
  }

  const handlePostSelect = (forum: string, post: string) => {
    navigate({
      to: '/$forum/$post',
      params: { forum, post },
      search: server ? { server } : undefined,
    })
  }

  return (
    <Main fixed>
      <div className='flex-1 overflow-y-auto'>
        {isLoadingForum ? (
          <div className='bg-card text-muted-foreground flex h-40 items-center justify-center rounded-xl border shadow-sm'>
            <div className='flex flex-col items-center gap-2'>
              <div className='border-primary size-4 animate-spin rounded-full border-2 border-t-transparent' />
              <p className='text-sm'>Loading forum...</p>
            </div>
          </div>
        ) : isForumError ? (
          <div className='bg-card text-muted-foreground flex h-40 items-center justify-center rounded-xl border shadow-sm'>
            <div className='flex flex-col items-center gap-3'>
              <p className='text-sm'>Forum not found or not accessible</p>
              <button
                type='button'
                onClick={() => subscribeMutation.mutate(forumId)}
                disabled={subscribeMutation.isPending}
                className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
              >
                {subscribeMutation.isPending
                  ? 'Subscribing...'
                  : 'Subscribe to forum'}
              </button>
            </div>
          </div>
        ) : (
          <ForumOverview
            forum={selectedForum || null}
            posts={selectedForumPosts}
            server={server}
            onSelectPost={handlePostSelect}
            onCreatePost={handleCreatePost}
            isCreatingPost={createPostMutation.isPending}
            isPostCreated={createPostMutation.isSuccess}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
          />
        )}
      </div>
    </Main>
  )
}
