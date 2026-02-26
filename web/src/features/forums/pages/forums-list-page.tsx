import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle, PageHeader, SortSelector, type SortType } from '@mochi/common'
import { Rss } from 'lucide-react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { Forum } from '@/api/types/forums'

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
}

export function ForumsListPage({
  forums: _initialForums,
}: ForumsListPageProps) {
  usePageTitle('Forums')
  const [sort, setSort] = useLocalStorage<SortType>('forums-sort', 'new')

  // Store "all forums" as the last location
  useEffect(() => {
    setLastForum(null)
  }, [])

  const { openForumDialog } = useSidebarContext()

  const navigate = useNavigate()

  // Queries
  const { data: forumsData, isLoading, ErrorComponent } = useForumsList(sort)
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

  return (
    <>
      <PageHeader
        title="Forums"
        icon={<Rss className='size-4 md:size-5' />}
        actions={<><SortSelector value={sort} onValueChange={setSort} /><OptionsMenu showRss /></>}
      />
      <Main fixed>
        {ErrorComponent || (
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
              subscribedIds={useMemo(() => new Set(forums.flatMap(f => [f.id, f.fingerprint].filter((x): x is string => !!x))), [forums])}
            />
          </div>
        )}
      </Main>
    </>
  )
}
