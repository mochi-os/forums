import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle, Button } from '@mochi/common'
import { Plus, Search } from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { ForumOverview } from '../components/forum-overview'

interface ForumsListPageProps {
  forums?: Forum[]
}

export function ForumsListPage({ forums: _initialForums }: ForumsListPageProps) {
  usePageTitle('Forums')
  const navigate = useNavigate()
  const { openForumDialog, openSearchDialog } = useSidebarContext()

  // Queries
  const { data: forumsData } = useForumsList()
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
    <Main fixed>
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold tracking-tight'>All forums</h1>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={openSearchDialog}>
            <Search className='mr-2 size-4' />
            Search
          </Button>
          <Button onClick={openForumDialog}>
            <Plus className='mr-2 size-4' />
            New forum
          </Button>
        </div>
      </div>
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
        />
      </div>
    </Main>
  )
}
