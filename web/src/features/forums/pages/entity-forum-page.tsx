import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import {
  Main,
  usePageTitle,
  Button,
  useScreenSize,
  PageHeader,
  SortSelector,
  type SortType,
  toast,
  getErrorMessage,
  GeneralError,
} from '@mochi/common'
import { Loader2, Rss, SquarePen, X } from 'lucide-react'
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
import { useLocalStorage } from '@/hooks/use-local-storage'
import { OptionsMenu } from '@/components/options-menu'
import { ForumOverview } from '../components/forum-overview'
import forumsApi from '@/api/forums'

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
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)
  const [sort, setSort] = useLocalStorage<SortType>('forums-sort', 'new')

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
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    can_manage: canManage,
    relevantFallback,
    error: postsError,
    refetch,
  } = useInfinitePosts({ forum: forum.id, entityContext, tag: activeTag, sort })

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

  const handleTagRemoved = useCallback(async (_forumId: string, postId: string, tagId: string) => {
    try {
      await forumsApi.removePostTag(forum.id, postId, tagId)
      refetch()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove tag'))
    }
  }, [forum.id, refetch])

  const handleTagFilter = useCallback((label: string) => {
    setActiveTag((current) => (current === label ? undefined : label))
  }, [])

  const handleInterestUp = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum.fingerprint ?? forum.id, qid, 'up')
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to adjust interest'))
      }
    },
    [forum.id, forum.fingerprint]
  )

  const handleInterestDown = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum.fingerprint ?? forum.id, qid, 'down')
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to adjust interest'))
      }
    },
    [forum.id, forum.fingerprint]
  )

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
            <SortSelector value={sort} onValueChange={setSort} />
            {canPost && (
              <Button onClick={() => openPostDialog(forum.id)}>
                <SquarePen className='mr-2 size-4' />
                New post
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
            <OptionsMenu
              entityId={forum.fingerprint}
              settingsUrl={canManage ? `/${forum.fingerprint ?? forum.id}/settings` : undefined}
            />
          </>
        }
      />
      <Main fixed>
        <div className="flex-1 overflow-y-auto">
          {activeTag && (
            <div className='flex items-center gap-2 mb-4'>
              <span className='text-muted-foreground text-sm'>Filtered by tag:</span>
              <button
                type='button'
                className='bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium'
                onClick={() => setActiveTag(undefined)}
              >
                {activeTag}
                <X className='size-3.5' />
              </button>
            </div>
          )}
          {sort === 'relevant' && relevantFallback && (
            <div className='bg-muted/50 text-muted-foreground rounded-[10px] px-4 py-3 text-sm mb-4'>
              No interests configured yet. Posts are shown in chronological order. Add interests in Settings to enable personalised ranking.
            </div>
          )}
          {postsError ? (
            <GeneralError
              error={postsError}
              minimal
              mode='inline'
              reset={refetch}
            />
          ) : (
            <ForumOverview
              forum={forumData || forum}
              posts={infinitePosts}
              onSelectPost={handlePostSelect}
              onTagRemoved={handleTagRemoved}
              onTagFilter={handleTagFilter}
              onInterestUp={handleInterestUp}
              onInterestDown={handleInterestDown}
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
