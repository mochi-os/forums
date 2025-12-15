import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Main } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { ForumsHeader } from './components/forums-header'
import { ForumsTabs } from './components/forums-tabs'

export function Forums() {
  const navigate = useNavigate()

  // Fetch list of forums
  const { data: forumsData } = useQuery({
    queryKey: ['forums', 'list'],
    queryFn: () => forumsApi.list(),
  })

  // For now, get the first forum to display posts (in a real app, user would select)
  const selectedForumId = forumsData?.data?.[0]?.id

  // Fetch posts for selected forum
  const { data: forumData } = useQuery({
    queryKey: ['forums', 'view', selectedForumId],
    queryFn: () => forumsApi.view(selectedForumId!),
    enabled: !!selectedForumId,
  })

  const posts = forumData?.data?.posts || []

  const handleThreadSelect = (threadId: string) => {
    navigate({
      to: `/thread/${threadId}`,
    })
  }

  // Convert Post[] to ForumThread[] for compatibility with existing components
  const threads = posts.map((post) => ({
    id: post.id,
    category: 'General', // Not in API, using default
    title: post.title,
    excerpt: post.body.substring(0, 150) + (post.body.length > 150 ? '...' : ''),
    content: post.body,
    author: {
      name: post.name,
      role: 'Member',
    },
    postedAt: post.created_local,
    tags: [], // Not in API
    status: 'open' as const,
    replyCount: post.comments,
    viewCount: 0, // Not in API
    participants: 0, // Not in API
    watchers: 0, // Not in API
    lastActivity: post.created_local,
    comments: [],
  }))

  return (
    <>
      <Main>
        <ForumsHeader
          searchTerm={''}
          onSearchChange={() => {}}
          onCreateForum={() => {}}
        />

        <ForumsTabs
          activeTab="all"
          onTabChange={() => {}}
          allThreads={threads}
          trendingThreads={[]}
          unansweredThreads={threads.filter(t => t.replyCount === 0)}
          onSelectThread={handleThreadSelect}
          normalizedSearch=""
        />
      </Main>
    </>
  )
}
