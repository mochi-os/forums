import { useEffect, useMemo, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import {
  GeneralError,
  Main,
  usePageTitle,
  PageHeader,
  SortSelector,
  type SortType,
  useAuthStore,
} from '@mochi/web'
import { Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'

import {
  useForumsList,
  selectForums,
  selectPosts,
  selectDefaultSort,
  useSetDefaultSort,
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
  const { t } = useLingui()
  usePageTitle(t`Forums`)
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)

  // Store "all forums" as the last location (authenticated users only)
  useEffect(() => {
    if (isLoggedIn) setLastForum(null)
  }, [isLoggedIn])

  const { openForumDialog } = useSidebarContext()

  const navigate = useNavigate()

  // The user's session override. Initially null so we adopt the server's
  // saved default once it loads.
  const [userSort, setUserSort] = useState<SortType | null>(null)

  // Queries
  const {
    data: forumsData,
    isLoading,
    error: forumsError,
    refetch: refetchForums,
  } = useForumsList(userSort ?? undefined)
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])
  const hasAi = !!(forumsData?.data as Record<string, unknown> | undefined)?.hasAi
  const defaultSort = selectDefaultSort(forumsData)
  const setDefaultSortMutation = useSetDefaultSort()

  // Adopt the server's saved default once it arrives, unless the user has
  // already overridden it this session.
  useEffect(() => {
    if (userSort === null && defaultSort && isLoggedIn) {
      setUserSort(defaultSort as SortType)
    }
  }, [defaultSort, userSort, isLoggedIn])

  const sort: SortType = userSort ?? 'new'
  const setSort = (value: SortType) => {
    setUserSort(value)
    setDefaultSortMutation.mutate(value)
  }
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
        title={t`Forums`}
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
              isLoggedIn={isLoggedIn}
            />
          </div>
        )}
      </Main>
    </>
  )
}
