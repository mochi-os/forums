import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/common'
import { Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useForumRecommendations,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { ForumOverview } from '../components/forum-overview'
import { PageHeader } from '@mochi/common'
import { setLastForum } from '@/hooks/use-forums-storage'

interface ForumsListPageProps {
  forums?: Forum[]
}

export function ForumsListPage({
  forums: _initialForums,
}: ForumsListPageProps) {
  usePageTitle('Forums')

  // Store "all forums" as the last location
  useEffect(() => {
    setLastForum(null)
  }, [])

  const navigate = useNavigate()
  const { openForumDialog } = useSidebarContext()

  // Queries - use initialForums as fallback until query returns data
  const { data: forumsData, isLoading, isFetching } = useForumsList()
  const queryHasData = !!forumsData?.data
  const forums = useMemo(() => {
    // If query has returned data, use it (even if empty - that's the real state)
    if (forumsData?.data?.forums) {
      return forumsData.data.forums
    }
    // Otherwise use initialForums from loader as fallback
    return _initialForums || []
  }, [forumsData, _initialForums])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])
  // Show loading state if we're fetching and don't have data yet
  const showLoading = (isLoading || isFetching) && !queryHasData

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useForumRecommendations()
  const recommendations = recommendationsData?.data?.forums ?? []

  // Set of subscribed forum IDs for inline search
  const subscribedIds = useMemo(
    () => new Set(forums.flatMap((f) => [f.id, f.fingerprint].filter(Boolean))),
    [forums]
  )

  const handlePostSelect = (forum: string, post: string) => {
    navigate({
      to: '/$forum/$post',
      params: { forum, post },
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

  return (
    <>
      <PageHeader
        title="Forums"
        icon={<Rss className='size-4 md:size-5' />}
      />
      <Main fixed>
      <div className='flex-1 overflow-y-auto'>
        <ForumOverview
          forum={null}
          forums={forums}
          posts={postsToDisplay}
          onSelectPost={handlePostSelect}
          onCreatePost={() => {}}
          isCreatingPost={false}
          isPostCreated={false}
          isLoading={showLoading}
          hasNextPage={false}
          isFetchingNextPage={false}
          onLoadMore={undefined}
          onOpenCreate={openForumDialog}
          subscribedIds={subscribedIds}
          recommendations={recommendations}
          isLoadingRecommendations={isLoadingRecommendations}
          isRecommendationsError={isRecommendationsError}
        />
      </div>
    </Main>
    </>
  )
}
