import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  requestHelpers,
  GeneralError,
  Button,
  Input,
} from '@mochi/common'
import { Loader2, Settings, SquarePen, Plus } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useSubscribeForum,
  useUnsubscribeForum,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { useInfinitePosts } from '@/hooks/use-infinite-posts'
import { ForumOverview } from '@/features/forums/components/forum-overview'
import { APP_ROUTES } from '@/config/routes'

// Response type for info endpoint
interface InfoResponse {
  entity: boolean
  forums?: Forum[]
  forum?: Forum
  permissions?: ForumPermissions
  fingerprint?: string
}

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    return requestHelpers.get<InfoResponse>(endpoints.forums.info)
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the forum page directly
  if (data.entity && data.forum) {
    return (
      <EntityForumPage forum={data.forum} permissions={data.permissions} />
    )
  }

  // Class context - show forums list
  return <ForumsListPage forums={data.forums} />
}

// Entity context: Show single forum
function EntityForumPage({
  forum,
  permissions,
}: {
  forum: Forum
  permissions?: ForumPermissions
}) {
  const navigate = useNavigate()

  // Set page title to forum name
  usePageTitle(forum.name || 'Forum')

  // Sidebar context for state sync
  const {
    setForum,
    setSubscription,
    subscribeHandler,
    unsubscribeHandler,
    openPostDialog,
  } = useSidebarContext()

  // Sync forum ID to sidebar context
  useEffect(() => {
    setForum(forum.id)
    return () => setForum(null)
  }, [forum.id, setForum])

  // Queries for subscription status
  const { data: forumsData } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])

  // Infinite posts query - use entityContext for domain routing
  const {
    posts: infinitePosts,
    forum: forumData,
    isLoading: isLoadingForum,
    isError: isForumError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfinitePosts({ forum: forum.id, entityContext: true })

  const selectedForumPosts = infinitePosts.filter(
    (p) => 'title' in p && p.title
  )

  // Mutations
  const createPostMutation = useCreatePost(forum.id)
  const subscribeMutation = useSubscribeForum()
  const unsubscribeMutation = useUnsubscribeForum(() => {
    navigate({ to: APP_ROUTES.HOME })
  })

  // Register subscribe/unsubscribe handlers with sidebar
  useEffect(() => {
    subscribeHandler.current = () => subscribeMutation.mutate(forum.id)
    unsubscribeHandler.current = () => unsubscribeMutation.mutate(forum.id)

    // Update subscription state for sidebar
    const localForum = forums.find((f) => f.id === forum.id)
    setSubscription({
      isRemote: !localForum,
      isSubscribed: !!localForum,
      canUnsubscribe: !!localForum && !localForum.can_manage,
    })

    return () => {
      subscribeHandler.current = null
      unsubscribeHandler.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum.id, forums, setSubscription])

  const handleCreatePost = (data: {
    title: string
    body: string
    attachments?: File[]
  }) => {
    createPostMutation.mutate({
      forum: forum.id,
      ...data,
    })
  }

  const handlePostSelect = (forumId: string, post: string) => {
    navigate({
      to: '/$forum/$post',
      params: { forum: forumId, post },
    })
  }

  // Use permissions from loader, fall back to forum data
  const canPost = permissions?.post ?? forumData?.can_post ?? false
  const canManage = permissions?.manage ?? forumData?.can_manage ?? false
  const isSubscribed = !!forums.find((f) => f.id === forum.id)
  const isRemoteForum = !isSubscribed
  const canUnsubscribe = isSubscribed && !canManage

  return (
    <Main fixed>
      {/* Action buttons */}
      <div className="-mt-1 mb-4 flex justify-end gap-2">
        {canPost && (
          <Button onClick={() => openPostDialog(forum.id)}>
            <SquarePen className="size-4" />
            New post
          </Button>
        )}
        {isRemoteForum && !isSubscribed && (
          <Button
            onClick={() => subscribeMutation.mutate(forum.id)}
            disabled={subscribeMutation.isPending}
          >
            {subscribeMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              'Subscribe'
            )}
          </Button>
        )}
        {canUnsubscribe && (
          <Button
            variant="outline"
            onClick={() => unsubscribeMutation.mutate(forum.id)}
            disabled={unsubscribeMutation.isPending}
          >
            {unsubscribeMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Unsubscribing...
              </>
            ) : (
              'Unsubscribe'
            )}
          </Button>
        )}
        {canManage && (
          <Button variant="outline" asChild>
            <Link to="/$forum/settings" params={{ forum: forum.fingerprint ?? forum.id }}>
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingForum ? (
          <div className="bg-card text-muted-foreground flex h-40 items-center justify-center rounded-xl border shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-sm">Loading forum...</p>
            </div>
          </div>
        ) : isForumError ? (
          <div className="bg-card text-muted-foreground flex h-40 items-center justify-center rounded-xl border shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm">Forum not found or not accessible</p>
              <button
                type="button"
                onClick={() => subscribeMutation.mutate(forum.id)}
                disabled={subscribeMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {subscribeMutation.isPending
                  ? 'Subscribing...'
                  : 'Subscribe to forum'}
              </button>
            </div>
          </div>
        ) : (
          <ForumOverview
            forum={forumData || forum}
            posts={selectedForumPosts}
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

// Class context: Show all forums list (original functionality)
function ForumsListPage({ forums: _initialForums }: { forums?: Forum[] }) {
  usePageTitle('Forums')
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { openForumDialog } = useSidebarContext()

  // Queries
  const { data: forumsData } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])

  const handlePostSelect = (forum: string, post: string) => {
    navigate({
      to: '/$forum/$post',
      params: { forum, post },
    })
  }

  // Show all posts from the list endpoint, with forum names added
  const postsToDisplay = useMemo(() => {
    return allPosts
      .map((post) => {
        const forum = forums.find((f) => f.id === post.forum)
        return {
          ...post,
          forumName: forum?.name ?? 'Unknown',
        }
      })
      .filter((post) => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
          post.title?.toLowerCase().includes(searchLower) ||
          post.forumName.toLowerCase().includes(searchLower)
        )
      })
  }, [allPosts, forums, search])

  return (
    <Main fixed>
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold tracking-tight'>All forums</h1>
        <div className='flex items-center gap-2'>
          <Input
            type='text'
            placeholder='Search...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-48'
          />
          <Button size='sm' onClick={openForumDialog}>
            <Plus className='mr-2 size-4' />
            New forum
          </Button>
        </div>
      </div>
      <div className='flex-1 overflow-y-auto'>
        <ForumOverview
          forum={null}
          posts={postsToDisplay}
          onSelectPost={handlePostSelect}
          onCreatePost={() => {}}
          isCreatingPost={false}
          isPostCreated={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onLoadMore={undefined}
        />
      </div>
    </Main>
  )
}
