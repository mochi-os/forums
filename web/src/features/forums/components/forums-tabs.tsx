import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Flame, MessageSquare, Users } from 'lucide-react'
import { ThreadListPanel } from './thread-list-panel'
import { type ForumThread } from '../data'

type ForumsTabsProps = {
  activeTab: string
  onTabChange: (value: string) => void
  allThreads: ForumThread[]
  trendingThreads: ForumThread[]
  unansweredThreads: ForumThread[]
  onSelectThread: (threadId: string) => void
  normalizedSearch: string
}

export function ForumsTabs({
  activeTab,
  onTabChange,
  allThreads,
  trendingThreads,
  unansweredThreads,
  onSelectThread,
  normalizedSearch,
}: ForumsTabsProps) {
  const searchActive = Boolean(normalizedSearch)

  const allEmptyTitle = searchActive ? 'No threads match your search' : 'No threads yet'
  const allEmptyDescription = searchActive
    ? 'Try a different keyword'
    : 'Be the first to start a conversation'

  const trendingEmptyTitle = searchActive
    ? 'No trending threads match your search'
    : 'Nothing is trending'
  const trendingEmptyDescription = searchActive
    ? 'Try another keyword'
    : 'Keep the conversations going'

  const unansweredEmptyTitle = searchActive
    ? 'No unanswered threads match your search'
    : 'Every thread has replies'
  const unansweredEmptyDescription = searchActive
    ? 'Try broadening your search'
    : 'Great work keeping discussions active'

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className='grid w-full max-w-2xl grid-cols-3'>
        <TabsTrigger value='all' className='relative'>
          All threads
          {allThreads.length > 0 && (
            <Badge
              variant='secondary'
              className='ml-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]'
            >
              <MessageSquare className='h-3 w-3' />
              {allThreads.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value='trending' className='relative'>
          Trending
          {trendingThreads.length > 0 && (
            <Badge
              variant='default'
              className='ml-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]'
            >
              <Flame className='h-3 w-3' />
              {trendingThreads.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value='unanswered' className='relative'>
          Unanswered
          {unansweredThreads.length > 0 && (
            <Badge
              variant='outline'
              className='ml-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]'
            >
              <Users className='h-3 w-3' />
              {unansweredThreads.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value='all' className='mt-6'>
        <ThreadListPanel
          threads={allThreads}
          onSelect={onSelectThread}
          emptyState={{
            icon: MessageSquare,
            title: allEmptyTitle,
            description: allEmptyDescription,
          }}
        />
      </TabsContent>

      <TabsContent value='trending' className='mt-6'>
        <ThreadListPanel
          threads={trendingThreads}
          onSelect={onSelectThread}
          emptyState={{
            icon: Flame,
            title: trendingEmptyTitle,
            description: trendingEmptyDescription,
          }}
        />
      </TabsContent>

      <TabsContent value='unanswered' className='mt-6'>
        <ThreadListPanel
          threads={unansweredThreads}
          onSelect={onSelectThread}
          emptyState={{
            icon: Users,
            title: unansweredEmptyTitle,
            description: unansweredEmptyDescription,
          }}
        />
      </TabsContent>
    </Tabs>
  )
}
