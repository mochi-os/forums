import { createFileRoute } from '@tanstack/react-router'
import { ThreadDetail } from '@/features/forums/thread-detail'

export const Route = createFileRoute('/thread/$forumId/$threadId')({
  component: ThreadDetail,
})
