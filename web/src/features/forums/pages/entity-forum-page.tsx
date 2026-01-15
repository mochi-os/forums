import { useEffect, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import { Main, usePageTitle, Button, useScreenSize } from '@mochi/common'
import { Loader2, Rss, Settings, SquarePen } from 'lucide-react'
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
import { PageHeader } from '@mochi/common'

interface EntityForumPageProps {
  forum: Forum
  permissions?: ForumPermissions
}

export function EntityForumPage({ forum, permissions }: EntityForumPageProps) {
  const navigate = useNavigate()
  const { isMobile } = useScreenSize()

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
    can_manage: canManage,
  } = useInfinitePosts({ forum: forum.id, entityContext: true })

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
                    {!isMobile && <span className='ml-2'>Unsubscribing...</span>}
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
                onClick={() => subscribeMutation.mutate(forum.id)}
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
            forum={forumData || forum}
            posts={infinitePosts}
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
    </>
  )
}
