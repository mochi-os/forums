import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle, PageHeader, type SortType } from '@mochi/common'
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

  const { openSearchDialog, openForumDialog } = useSidebarContext()

  const navigate = useNavigate()
  const [sort, setSort] = useState<SortType>('new')

  // Queries
  const { data: forumsData, isLoading, ErrorComponent } = useForumsList(sort)
  const forums = useMemo(() => selectForums(forumsData), [forumsData])
  const allPosts = useMemo(() => selectPosts(forumsData), [forumsData])

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

  const subscribedIds = useMemo(
    () => new Set(forums.map((f) => f.id)),
    [forums]
  )

  return (
    <>
      <PageHeader
        title="Forums"
        icon={<Rss className="size-4 md:size-5" />}
      />
      <Main fixed>
        {ErrorComponent || (
          <div className="flex-1 overflow-y-auto">
            <ForumOverview
              forum={null}
              posts={postsToDisplay}
              sort={sort}
              onSortChange={setSort}
              onSelectPost={handlePostSelect}
              onCreatePost={() => {}}
              onFindForums={openSearchDialog}
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
