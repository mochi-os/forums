import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  GeneralError,
  Main,
  usePageTitle,
  PageHeader,
  SortSelector,
  type SortType,
  useShellStorage,
  useAuthStore,
  shellSubscribeNotifications,
} from '@mochi/web'
import { Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import forumsApi from '@/api/forums'

import {
  useForumsList,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { ForumOverview } from '../components/forum-overview'
import { setLastForum } from '@/hooks/use-forums-storage'
import { useSidebarContext } from '@/context/sidebar-context'
import { OptionsMenu } from '@/components/options-menu'

interface ForumsListPageProps {
  forums?: Forum[]
  loaderError?: string | null
  onRetryLoader?: () => void
}

export function ForumsListPage({
  forums: _initialForums,
  loaderError,
  onRetryLoader,
}: ForumsListPageProps) {
  usePageTitle('Forums')
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const [savedSort, setSort] = useShellStorage<SortType>('forums-sort', 'new')
  const sort = isLoggedIn ? savedSort : 'new'

  // Store "all forums" as the last location (authenticated users only)
  useEffect(() => {
    if (isLoggedIn) setLastForum(null)
  }, [isLoggedIn])

  // Notification subscription prompt
  const { data: subscriptionData, refetch: refetchSubscription } = useQuery({
    queryKey: ['subscription-check', 'forums'],
    queryFn: () => forumsApi.checkSubscription(),
    staleTime: Infinity,
    enabled: isLoggedIn,
  })
  const promptedNotifications = useRef(false)
  useEffect(() => {
    if (promptedNotifications.current) return
    if (!subscriptionData?.data) return
    const { exists, types } = subscriptionData.data
    if (!exists) {
      promptedNotifications.current = true
      shellSubscribeNotifications('forums', [
        { label: 'New posts', type: 'post', defaultEnabled: true },
        { label: 'New comments', type: 'comment', defaultEnabled: true },
        { label: 'Mentions', type: 'mention', defaultEnabled: true },
      ]).then(() => refetchSubscription())
    } else if (!types.includes('mention')) {
      promptedNotifications.current = true
      shellSubscribeNotifications('forums', [
        { label: 'Mentions', type: 'mention', defaultEnabled: true },
      ]).then(() => refetchSubscription())
    }
  }, [subscriptionData?.data, refetchSubscription])

  const { openForumDialog } = useSidebarContext()

  const navigate = useNavigate()

  // Queries
  const {
    data: forumsData,
    isLoading,
    error: forumsError,
    refetch: refetchForums,
  } = useForumsList(sort)
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])
  const hasAi = !!(forumsData?.data as Record<string, unknown> | undefined)?.hasAi
  const sortOptions: SortType[] = useMemo(() => {
    const opts: SortType[] = []
    if (hasAi) opts.push('ai')
    opts.push('interests', 'new', 'hot', 'top')
    return opts
  }, [hasAi])
  const loaderOwnedError = useMemo(
    () => (loaderError ? new Error(loaderError) : null),
    [loaderError]
  )

  const handlePostSelect = (forum: string, post: string) => {
    navigate({
      to: '/$forum/$post',
      params: { forum, post },
      search: { from: 'all' },
    })
  }

  // Show all posts from the list endpoint, with forum names added
  const postsToDisplay = useMemo(() => {
    return allPosts.map((post) => {
      const forum = forums.find((f) => f.id === post.forum)
      return {
        ...post,
        forumName: forum?.name ?? 'Unknown',
      }
    })
  }, [allPosts, forums])

  const subscribedIds = useMemo(
    () => new Set(forums.flatMap((f) => [f.id, f.fingerprint].filter((x): x is string => !!x))),
    [forums]
  )
  const hasUsableData = forums.length > 0 || postsToDisplay.length > 0
  const showLoaderError =
    !!loaderOwnedError &&
    !forumsError &&
    (!isLoading || hasUsableData)

  return (
    <>
      <PageHeader
        title="Forums"
        icon={<Rss className='size-4 md:size-5' />}
        actions={<>{isLoggedIn && <SortSelector value={sort} onValueChange={setSort} options={sortOptions} />}</>}
        menuAction={<OptionsMenu showRss />}
      />
      <Main fixed>
        {showLoaderError && (
          <GeneralError
            error={loaderOwnedError}
            minimal
            mode='inline'
            reset={onRetryLoader}
          />
        )}
        {forumsError ? (
          <GeneralError
            error={forumsError}
            minimal
            mode='inline'
            reset={() => {
              void refetchForums()
            }}
          />
        ) : (
          <div className='flex-1 overflow-y-auto'>
            <ForumOverview
              forum={null}
              posts={postsToDisplay}
              onSelectPost={handlePostSelect}
              onCreatePost={() => {}}
              onCreateForum={openForumDialog}
              isCreatingPost={false}
              isPostCreated={false}
              hasNextPage={false}
              isFetchingNextPage={false}
              onLoadMore={undefined}
              isLoading={isLoading}
              subscribedIds={subscribedIds}
            />
          </div>
        )}
      </Main>
    </>
  )
}
