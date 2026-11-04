// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Trans } from '@lingui/react/macro'
import { cn } from '@mochi/web'
import type { ForumDestination } from '@/api/types/forums'

/** Where a post or comment written in a community goes, and as which account:
 *  the community's own server always has it, so there is nothing to choose. */
export function CommunityDestination({
  destination,
  className,
}: {
  destination?: ForumDestination
  className?: string
}) {
  if (!destination) return null
  const { community, account } = destination
  return (
    <p className={cn('text-muted-foreground text-sm break-all', className)}>
      <Trans>
        Posts to {community} as {account}
      </Trans>
    </p>
  )
}
