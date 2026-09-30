// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Trans, useLingui } from '@lingui/react/macro'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  OptionsMenu as SharedOptionsMenu,
} from '@mochi/web'
import { Bell } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { NotificationKind } from '@/api/types/forums'
import {
  useForumNotifications,
  useSetForumNotification,
} from '@/hooks/use-forums-queries'

interface OptionsMenuProps {
  entityId?: string
  showRss?: boolean
  onModeration?: () => void
  onSettings?: () => void
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
  /** Show the 'Link' share-link dialog entry - owner only (the share action is owner-gated). */
  canShare?: boolean
  /** A forum the user holds, whose activity notifications the menu offers. */
  notificationsForum?: string
}

const createShareLink = async (entityId: string) =>
  (await forumsApi.shareForum(entityId)).data.link

const createRssToken = async (entity: string, mode: 'posts' | 'all') =>
  (await forumsApi.getRssToken(entity, mode)).data.token

const revokeRssToken = async (entity: string) => {
  await forumsApi.revokeRssToken(entity)
}

// Binds the forums api and routing to the shared entity menu.
export function OptionsMenu({ notificationsForum, ...props }: OptionsMenuProps) {
  return (
    <SharedOptionsMenu
      {...props}
      linkTitle={<Trans>Forum link</Trans>}
      createShareLink={createShareLink}
      createRssToken={createRssToken}
      revokeRssToken={revokeRssToken}
    >
      {notificationsForum && (
        <NotificationsMenu forumId={notificationsForum} />
      )}
    </SharedOptionsMenu>
  )
}

function NotificationsMenu({ forumId }: { forumId: string }) {
  const { t } = useLingui()
  const { data } = useForumNotifications(forumId, true)
  const setNotification = useSetForumNotification(forumId)
  const settings = data?.data

  const kinds: { kind: NotificationKind; label: string }[] = [
    { kind: 'post', label: t`New posts` },
    { kind: 'reply', label: t`Replies to you` },
    { kind: 'comment', label: t`All replies` },
  ]

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Bell className='me-2 size-4' />
        <Trans>Notifications</Trans>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {kinds.map(({ kind, label }) => (
          <DropdownMenuCheckboxItem
            key={kind}
            checked={settings?.[kind] ?? false}
            disabled={!settings}
            // Stay open so several can be set in one visit.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              setNotification.mutate({ kind, enabled: checked })
            }
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
