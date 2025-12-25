import type { DirectoryEntry } from '@/api/types/forums'
import { ForumCard } from './forum-card'

type ForumGridProps = {
  forums: (DirectoryEntry & { isSubscribed?: boolean })[]
  onSubscribe?: (forumId: string) => void
  subscribingId?: string | null
}

export function ForumGrid({
  forums,
  onSubscribe,
  subscribingId,
}: ForumGridProps) {
  if (forums.length === 0) {
    return null
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {forums.map((forum) => (
        <ForumCard
          key={forum.id}
          forum={forum}
          onSubscribe={onSubscribe}
          isSubscribing={subscribingId === forum.id}
        />
      ))}
    </div>
  )
}
