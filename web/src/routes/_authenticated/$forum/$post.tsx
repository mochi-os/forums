// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getEntityFingerprint, isDomainEntityRouting } from '@mochi/web'
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
