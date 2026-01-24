import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/common'
import { Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useForumRecommendations,
  selectForums,
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

  // Queries
  const { data: forumsData } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])

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
        title="All forums"
        icon={<Rss className='size-4 md:size-5' />}
      />
      <Main fixed>
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
