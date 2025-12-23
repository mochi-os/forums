import { Link } from '@tanstack/react-router'
import { Button, cn } from '@mochi/common'
import type { DirectoryEntry } from '@/api/types/forums'
import { Hash } from 'lucide-react'

type ForumCardProps = {
  forum: DirectoryEntry & { isSubscribed?: boolean }
  onSubscribe?: (forumId: string) => void
  isSubscribing?: boolean
}

export function ForumCard({ forum, onSubscribe, isSubscribing }: ForumCardProps) {
  const handleSubscribeClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSubscribe?.(forum.id)
  }

  const formattedFingerprint = forum.fingerprint?.match(/.{1,3}/g)?.join('-') ?? ''

  return (
    <Link
      to="/$forum"
      params={{ forum: forum.id }}
      className={cn(
        'group flex items-center gap-3 rounded-[8px] border p-4 transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm'
      )}
    >
      <div
        className={cn(
          'shrink-0 rounded-[8px] bg-primary/10 p-2 transition-colors',
          'group-hover:bg-primary/20'
        )}
      >
        <Hash className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{forum.name}</div>
        {formattedFingerprint && (
          <div className="truncate text-xs text-muted-foreground pl-2">{formattedFingerprint}</div>
        )}
      </div>
      {!forum.isSubscribed && onSubscribe && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isSubscribing}
          onClick={handleSubscribeClick}
          className="shrink-0 text-xs"
        >
          {isSubscribing ? 'Subscribing...' : 'Subscribe'}
        </Button>
      )}
    </Link>
  )
}
