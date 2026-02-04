import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle, PageHeader, type ViewMode } from '@mochi/common'
import { Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'

import {
  useForumsList,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { ForumOverview } from '../components/forum-overview'
import { setLastForum } from '@/hooks/use-forums-storage'
import { useSidebarContext } from '@/context/sidebar-context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { OptionsMenu } from '@/components/options-menu'

interface ForumsListPageProps {
  forums?: Forum[]
}

export function ForumsListPage({
  forums: _initialForums,
}: ForumsListPageProps) {
  usePageTitle('Forums')

  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    'forums-view-mode',
    'card'
  )

  // Store "all forums" as the last location
  useEffect(() => {
    setLastForum(null)
  }, [])

  const { openForumDialog } = useSidebarContext()

  const navigate = useNavigate()

  // Queries
  const { data: forumsData, isLoading, ErrorComponent } = useForumsList()
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])

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
    () => new Set(forums.map((f) => f.id)),
    [forums]
  )

  return (
    <>
      <PageHeader
        title="Forums"
        icon={<Rss className='size-4 md:size-5' />}
        actions={<OptionsMenu viewMode={viewMode} onViewModeChange={setViewMode} />}
      />
      <Main fixed>
        {ErrorComponent || (
          <div className='flex-1 overflow-y-auto'>
            <ForumOverview
              forum={null}
              posts={postsToDisplay}
              viewMode={viewMode}
              onSelectPost={handlePostSelect}
              onCreatePost={() => {}}
              onCreateForum={openForumDialog}
              isCreatingPost={false}
              isPostCreated={false}
              hasNextPage={false}
              isFetchingNextPage={false}
              onLoadMore={undefined}
              isLoading={isLoading}
              subscribedIds={useMemo(() => new Set(forums.flatMap(f => [f.id, f.fingerprint].filter((x): x is string => !!x))), [forums])}
            />
          </div>
        )}
      </Main>
    </>
  )
}
