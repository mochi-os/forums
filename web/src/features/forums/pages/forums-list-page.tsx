import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle, Button } from '@mochi/common'
import { Search, Rss } from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
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
  const { openSearchDialog } = useSidebarContext()

  // Queries
  const { data: forumsData, isLoading } = useForumsList()
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

  return (
    <>
      <PageHeader
        title="All forums"
        icon={<Rss className='size-4 md:size-5' />}
        searchBar={
          <Button 
            variant='outline' 
            className='w-full justify-start'
            onClick={openSearchDialog}
          >
            <Search className='mr-2 size-4' />
            Search forums
          </Button>
        }
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
          isLoading={isLoading}
        />
      </div>
    </Main>
    </>
  )
}
