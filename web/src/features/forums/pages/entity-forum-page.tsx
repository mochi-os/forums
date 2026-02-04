import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import {
  Main,
  usePageTitle,
  Button,
  useScreenSize,
  EmptyState,
  PageHeader,
  type SortType,
} from '@mochi/common'
import { Loader2, Rss, Settings, SquarePen, AlertCircle } from 'lucide-react'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useSubscribeForum,
  useUnsubscribeForum,
  selectForums,
} from '@/hooks/use-forums-queries'
import { useInfinitePosts } from '@/hooks/use-infinite-posts'
import { ForumOverview } from '../components/forum-overview'

interface EntityForumPageProps {
  forum: Forum
  permissions?: ForumPermissions
  entityContext?: boolean
}

export function EntityForumPage({
  forum,
  permissions,
  entityContext = false,
}: EntityForumPageProps) {
  const navigate = useNavigate()
  const { isMobile } = useScreenSize()
  const [sort, setSort] = useState<SortType>('new')

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
  const { data: forumsData, isLoading: isLoadingForums } = useForumsList()
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
    can_manage: canManage,
  } = useInfinitePosts({ forum: forum.id, entityContext, sort })

  // Mutations
  const createPostMutation = useCreatePost(forum.id)
  const subscribeMutation = useSubscribeForum()
  const unsubscribeMutation = useUnsubscribeForum(() => {
    navigate({ to: APP_ROUTES.HOME })
  })

  // Register subscribe/unsubscribe handlers with sidebar
  useEffect(() => {
    subscribeHandler.current = () =>
      subscribeMutation.mutate({ forumId: forum.id, server: forum.server })
    unsubscribeHandler.current = () => unsubscribeMutation.mutate(forum.id)

    // Update subscription state for sidebar
    const localForum = forums.find((f) => f.id === forum.id)
    setSubscription({
      isRemote: !localForum,
      isSubscribed: !!localForum,
      canUnsubscribe: !!localForum && !canManage,
    })

    return () => {
      subscribeHandler.current = null
      unsubscribeHandler.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forum.id, forums, setSubscription, canManage])

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

  // Use values from hook
  const canPost = forumData?.can_post ?? permissions?.post ?? false
  const isSubscribed = !!forums.find((f) => f.id === forum.id)
  const isRemoteForum = !isSubscribed
  const canUnsubscribe = isSubscribed && !canManage

  return (
    <>
      <PageHeader
        title={forum.name || 'Forum'}
        icon={<Rss className='size-4 md:size-5' />}
        actions={
          <>
            {canPost && (
              <Button onClick={() => openPostDialog(forum.id)}>
                <SquarePen className='mr-2 size-4' />
                Create post
              </Button>
            )}
            {!isLoadingForums && isRemoteForum && !isSubscribed && (
              <Button
                onClick={() =>
                  subscribeMutation.mutate({
                    forumId: forum.id,
                    server: forum.server,
                  })
                }
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    {!isMobile && <span className='ml-2'>Subscribing...</span>}
                  </>
                ) : (
                  'Subscribe'
                )}
              </Button>
            )}
            {canUnsubscribe && (
              <Button
                variant='outline'
                onClick={() => unsubscribeMutation.mutate(forum.id)}
                disabled={unsubscribeMutation.isPending}
              >
                {unsubscribeMutation.isPending ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    {!isMobile && (
                      <span className='ml-2'>Unsubscribing...</span>
                    )}
                  </>
                ) : (
                  'Unsubscribe'
                )}
              </Button>
            )}
            {canManage && (
              <Button variant='outline' asChild>
                <Link
                  to='/$forum/settings'
                  params={{ forum: forum.fingerprint ?? forum.id }}
                >
                  <Settings className={isMobile ? 'size-4' : 'mr-2 size-4'} />
                  {!isMobile && 'Settings'}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Main fixed>
        <div className='flex-1 overflow-y-auto'>
          {isForumError ? (
            <EmptyState
              icon={AlertCircle}
              title='Forum not found or not accessible'
              description='You might need to subscribe to access this forum'
            >
              <Button
                onClick={() =>
                  subscribeMutation.mutate({
                    forumId: forum.id,
                    server: forum.server,
                  })
                }
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending
                  ? 'Subscribing...'
                  : 'Subscribe to forum'}
              </Button>
            </EmptyState>
          ) : (
            <ForumOverview
              forum={forumData || forum}
              posts={infinitePosts}
              sort={sort}
              onSortChange={setSort}
              onSelectPost={handlePostSelect}
              onCreatePost={handleCreatePost}
              isCreatingPost={createPostMutation.isPending}
              isPostCreated={createPostMutation.isSuccess}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              isLoading={isLoadingForum}
            />
          )}
        </div>
      </Main>
    </>
  )
}
