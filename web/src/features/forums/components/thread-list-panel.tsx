import { type ComponentType } from 'react'
import { ScrollArea, Card, CardContent } from '@mochi/common'
import { ThreadListItem } from './thread-list-item'
import { type ForumThread } from '../data'

type ThreadListPanelProps = {
  threads: ForumThread[]
  onSelect: (threadId: string) => void
  emptyState: {
    icon: ComponentType<{ className?: string }>
    title: string
    description: string
  }
}

export function ThreadListPanel({ threads, onSelect, emptyState }: ThreadListPanelProps) {
  const EmptyIcon = emptyState.icon

  return (
    <Card>
      <CardContent className='p-0'>
        <ScrollArea className='h-[calc(100vh-310px)]'>
          <div className='p-4'>
            {threads.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-12 text-center'>
                <EmptyIcon className='mb-4 size-12 text-muted-foreground/50' />
                <p className='text-sm font-medium text-muted-foreground'>{emptyState.title}</p>
                <p className='mt-1 text-xs text-muted-foreground/80'>{emptyState.description}</p>
              </div>
            ) : (
              <div className='space-y-3'>
                {threads.map((thread) => (
                  <ThreadListItem key={thread.id} thread={thread} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
