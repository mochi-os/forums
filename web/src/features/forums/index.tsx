import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/common'
import {
  useForumsList,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { ForumOverview } from './components/forum-overview'

export function Forums() {
  usePageTitle('Forums')
  const navigate = useNavigate()

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
    return allPosts.map(post => {
      const forum = forums.find((f) => f.id === post.forum)
      return {
        ...post,
        forumName: forum?.name ?? 'Unknown',
      }
    })
  }, [allPosts, forums])

  return (
    <Main fixed>
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
    </Main>
  )
}
