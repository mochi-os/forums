import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ThreadDetail } from '@/features/forums/thread-detail'

const searchSchema = z.object({
  server: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/$post')({
  validateSearch: searchSchema,
  component: ThreadDetailWrapper,
})

function ThreadDetailWrapper() {
  const { server } = Route.useSearch()
  return <ThreadDetail server={server} />
}
