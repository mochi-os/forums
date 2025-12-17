import {
  cn,
  Badge,
} from '@mochi/common'
import {
  Users,
  Hash,
  Clock,
} from 'lucide-react'
import type { Forum } from '@/api/types/forums'

interface ForumListItemProps {
  forum: Forum
  isActive: boolean
  postCount: number
  onSelect: (forumId: string) => void
}

export function ForumListItem({ forum, isActive, postCount, onSelect }: ForumListItemProps) {
  const handleActivate = () => onSelect(forum.id)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActivate()
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        'group w-full overflow-hidden rounded-xl border p-3 text-start transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50',
        isActive 
          ? 'border-primary bg-primary/5 text-foreground shadow-sm' 
          : 'bg-card'
      )}
    >
      {/* Header Row: Icon + Name + Owner Badge */}
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'shrink-0 rounded-lg bg-primary/10 p-1.5 transition-colors',
            'group-hover:bg-primary/20'
          )}
        >
          <Hash className="size-3.5 text-primary" />
        </div>

        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {forum.name}
        </span>

        {forum.role === '' && (
          <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
            Owner
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {postCount} posts in this forum
      </p>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <Users className="size-3" />
            <span className="font-medium">{forum.members}</span>
            <span>members</span>
          </span>

          <span className="flex min-w-0 items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{formatDate(forum.updated)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
