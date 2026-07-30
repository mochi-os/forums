// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Trans } from '@lingui/react/macro'
import { OptionsMenu as SharedOptionsMenu } from '@mochi/web'
import forumsApi from '@/api/forums'

interface OptionsMenuProps {
  entityId?: string
  showRss?: boolean
  onModeration?: () => void
  onSettings?: () => void
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
  /** Show the 'Link' share-link dialog entry - owner only (the share action is owner-gated). */
  canShare?: boolean
}

const createShareLink = async (entityId: string) =>
  (await forumsApi.shareForum(entityId)).data.link

const createRssToken = async (entity: string, mode: 'posts' | 'all') =>
  (await forumsApi.getRssToken(entity, mode)).data.token

const revokeRssToken = async (entity: string) => {
  await forumsApi.revokeRssToken(entity)
}

// Binds the forums api and routing to the shared entity menu.
export function OptionsMenu(props: OptionsMenuProps) {
  return (
    <SharedOptionsMenu
      {...props}
      linkTitle={<Trans>Forum link</Trans>}
      createShareLink={createShareLink}
      createRssToken={createRssToken}
      revokeRssToken={revokeRssToken}
    />
  )
}
