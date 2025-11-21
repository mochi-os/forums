import { Flame, MessageSquare, Pin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { threadStatusStyles } from '../status'
import { type ForumThread } from '../data'

type ThreadListItemProps = {
  thread: ForumThread
  onSelect: (threadId: string) => void
}

export function ThreadListItem({ thread, onSelect }: ThreadListItemProps) {
  const status = threadStatusStyles[thread.status]
  const StatusIcon = status.icon

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => onSelect(thread.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(thread.id)
        }
      }}
      className='group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-border/40 bg-card/60 p-4 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
    >
      {thread.pinned && (
        <div className='absolute right-4 top-4 text-muted-foreground'>
          <Pin className='size-4' />
        </div>
      )}
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='secondary'>{thread.category}</Badge>
        <Badge
          variant='outline'
          className={cn('border px-2 py-1 text-[11px]', status.className)}
        >
          <StatusIcon className='mr-1 size-3' />
          {status.label}
        </Badge>
      </div>
      <div className='space-y-2'>
        <h3 className='text-lg font-semibold leading-tight'>{thread.title}</h3>
        <p className='text-sm text-muted-foreground line-clamp-2'>{thread.excerpt}</p>
        <div className='flex flex-wrap gap-2'>
          {thread.tags.map((tag) => (
            <Badge key={tag} variant='outline' className='text-xs font-medium'>
              #{tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4 text-xs text-muted-foreground'>
        <div className='flex items-center gap-3'>
          <Avatar className='size-9'>
            <AvatarImage src={thread.author.avatar} alt={thread.author.name} />
            <AvatarFallback>
              {thread.author.name
                .split(' ')
                .map((name) => name[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='text-sm font-medium text-foreground'>{thread.author.name}</p>
            <p>{thread.lastActivity}</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-4 text-sm text-foreground'>
          <div className='flex items-center gap-1'>
            <MessageSquare className='size-4 text-muted-foreground' />
            {thread.replyCount} replies
          </div>
          <div className='flex items-center gap-1'>
            <Users className='size-4 text-muted-foreground' />
            {thread.participants} participants
          </div>
          <div className='flex items-center gap-1'>
            <Flame className='size-4 text-muted-foreground' />
            {thread.viewCount} views
          </div>
        </div>
      </div>
    </div>
  )
}
