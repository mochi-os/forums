import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import {
  Main,
  usePageTitle,
  Button,
  useScreenSize,
  PageHeader,
  SortSelector,
  type SortType,
  NewItemsPill,
  usePendingItems,
  toast,
  getErrorMessage,
  GeneralError,
  useAuthStore,
  useMergeOnScrollTop,
  ConfirmDialog,
} from '@mochi/web'
import { Loader2, Rss, SquarePen, X } from 'lucide-react'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useSubscribeForum,
  useUnsubscribeForum,
  selectForums,
  selectDefaultSort,
  useSetForumSort,
} from '@/hooks/use-forums-queries'
import { useInfinitePosts } from '@/hooks/use-infinite-posts'
import { useForumWebsocket } from '@/hooks/use-forum-websocket'
import { OptionsMenu } from '@/components/options-menu'
import { ForumBanner } from '../components/forum-banner'
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
  const { t } = useLingui()
  const navigate = useNavigate()
  const router = useRouter()
  const { isMobile } = useScreenSize()
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false)

  // Per-forum override → falls back to the global default → falls back to 'new'.
  const [userSort, setUserSort] = useState<SortType | null>(
    forum.sort ? (forum.sort as SortType) : null
  )
  // Re-seed when navigating between forums or when the loader refreshes with
  // a new saved sort.
  useEffect(() => {
    setUserSort(forum.sort ? (forum.sort as SortType) : null)
  }, [forum.id, forum.sort])
  const setForumSortMutation = useSetForumSort(forum.id)

  // Set page title to forum name
  usePageTitle(forum.name || t`Forum`)

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

  // Clear notifications for this forum
  useEffect(() => {
    if (isLoggedIn) {
      forumsApi.clearNotifications(forum.fingerprint ?? forum.id)
    }
  }, [forum.id, forum.fingerprint, isLoggedIn])

  // Queries for subscription status
  const { data: forumsData, isLoading: isLoadingForums } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const defaultSort = selectDefaultSort(forumsData)

  // Adopt the global default once it loads, unless the user has overridden
  // (or this forum already has its own override from forum.sort).
  useEffect(() => {
    if (userSort === null && defaultSort && isLoggedIn) {
      setUserSort(defaultSort as SortType)
    }
  }, [defaultSort, userSort, isLoggedIn])

  const sort: SortType = userSort ?? 'new'
  const setSort = (value: SortType) => {
    setUserSort(value)
    setForumSortMutation.mutate(value, {
      onSuccess: () => {
        // Bust the route loader so a subsequent navigation back to this forum
        // sees the freshly-saved forum.sort instead of the cached row.
        void router.invalidate()
      },
    })
  }

  // Infinite posts query - use entityContext for domain routing
  const {
    posts: infinitePosts,
    forum: forumData,
    member: forumMember,
    isLoading: isLoadingForum,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    can_manage: canManage,
    can_moderate: canModerate,
    hasAi,
    error: postsError,
    refetch,
  } = useInfinitePosts({ forum: forum.id, entityContext, tag: activeTag, sort })

  // Queue real-time new posts behind a "new posts available" pill instead of
  // injecting them while the user is reading.
  const newPosts = usePendingItems()
  const scrollRef = useRef<HTMLDivElement>(null)
  const handleShowNewPosts = useCallback(() => {
    newPosts.clear()
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    void refetch()
  }, [newPosts, refetch])

  // Real-time updates via WebSocket
  useForumWebsocket(forum.fingerprint, forumMember?.id, (postId) =>
    newPosts.add(postId)
  )
  const sortOptions: SortType[] = useMemo(() => {
    const opts: SortType[] = []
    if (hasAi) opts.push('ai')
    opts.push('interests', 'new', 'hot', 'top')
    return opts
  }, [hasAi])

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
    unsubscribeHandler.current = () => setShowUnsubscribeConfirm(true)

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

  const handleTagFilter = useCallback((label: string) => {
    setActiveTag((current) => (current === label ? undefined : label))
  }, [])

  useMergeOnScrollTop({
    scrollRef,
    active: newPosts.count > 0,
    onMerge: handleShowNewPosts,
  })

  const handleInterestUp = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum.fingerprint ?? forum.id, qid, 'up')
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to adjust interest`))
      }
    },
    [forum.id, forum.fingerprint, t]
  )

  const handleInterestDown = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum.fingerprint ?? forum.id, qid, 'down')
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to adjust interest`))
      }
    },
    [forum.id, forum.fingerprint, t]
  )

  const handleInterestRemove = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum.fingerprint ?? forum.id, qid, 'remove')
        toast.success(t`Interest removed`)
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to remove interest`))
      }
    },
    [forum.id, forum.fingerprint, t]
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
        title={forum.name || t`Forum`}
        icon={<Rss className='size-4 md:size-5' />}
        actions={
          <>
            {isLoggedIn && <SortSelector value={sort} onValueChange={setSort} options={sortOptions} />}
            {canPost && (
              <Button onClick={() => openPostDialog(forum.id)}>
                <SquarePen className='me-2 size-4' />
                <Trans>New post</Trans>
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
                    {!isMobile && <span className='ms-2'><Trans>Subscribing...</Trans></span>}
                  </>
                ) : (
                  <Trans>Subscribe</Trans>
                )}
              </Button>
            )}
          </>
        }
        menuAction={
          <OptionsMenu
            entityId={forum.fingerprint}
            settingsUrl={canManage ? `/${forum.fingerprint ?? forum.id}/settings` : undefined}
            moderationUrl={(canManage || canModerate) ? `/${forum.fingerprint ?? forum.id}/moderation` : undefined}
            onUnsubscribe={canUnsubscribe ? () => setShowUnsubscribeConfirm(true) : undefined}
            unsubscribePending={unsubscribeMutation.isPending}
          />
        }
      />
      <Main fixed>
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <NewItemsPill
            count={newPosts.count}
            onClick={handleShowNewPosts}
            label={
              <Plural value={newPosts.count} one="# new post" other="# new posts" />
            }
          />
          {forum.banner_html && (
            <ForumBanner bannerHtml={forum.banner_html} forumId={forum.id} />
          )}
          {activeTag && (
            <div className='flex items-center gap-2 mb-4'>
              <span className='text-muted-foreground text-sm'><Trans>Filtered by tag:</Trans></span>
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
              onTagFilter={handleTagFilter}
              onInterestUp={handleInterestUp}
              onInterestDown={handleInterestDown}
              onInterestRemove={handleInterestRemove}
              isLoggedIn={isLoggedIn}
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

      <ConfirmDialog
        open={showUnsubscribeConfirm}
        onOpenChange={setShowUnsubscribeConfirm}
        title={<Trans>Unsubscribe from forum?</Trans>}
        desc={<Trans>You will stop receiving updates from this forum. You can re-subscribe at any time.</Trans>}
        destructive
        confirmText={<Trans>Unsubscribe</Trans>}
        handleConfirm={() => unsubscribeMutation.mutate(forum.id)}
        isLoading={unsubscribeMutation.isPending}
      />
    </>
  )
}
