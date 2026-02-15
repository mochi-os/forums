import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getEntityFingerprint, isDomainEntityRouting } from '@mochi/common'
import { ThreadDetail } from '@/features/forums/thread-detail'

const searchSchema = z.object({
  server: z.string().optional(),
  from: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/$post')({
  validateSearch: searchSchema,
  component: ThreadDetailWrapper,
})

function ThreadDetailWrapper() {
  const { server, from } = Route.useSearch()
  const { forum: urlForum } = Route.useParams()

  // In domain entity routing, use the domain fingerprint as forum ID
  const domainFingerprint = getEntityFingerprint()
  const forum = (isDomainEntityRouting() && domainFingerprint) ? domainFingerprint : urlForum

  return <ThreadDetail server={server} forumOverride={forum} fromAllForums={from === 'all'} />
}
