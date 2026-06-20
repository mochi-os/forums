// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Gavel, Loader2, MoreHorizontal, Rss, Settings, UserMinus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
  getErrorMessage,
  getAppPath,
  shellClipboardWrite,
} from '@mochi/web'
import forumsApi from '@/api/forums'

interface OptionsMenuProps {
  entityId?: string
  showRss?: boolean
  settingsUrl?: string
  moderationUrl?: string
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
}

export function OptionsMenu({ entityId, showRss, settingsUrl, moderationUrl, onUnsubscribe, unsubscribePending }: OptionsMenuProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const rssEntity = entityId || (showRss ? '*' : null)

  const handleCopyRssUrl = async (mode: 'posts' | 'all') => {
    if (!rssEntity) return
    try {
      const response = await forumsApi.getRssToken(rssEntity, mode)
      const token = response.data.token
      const url = rssEntity === '*'
        ? `${window.location.origin}${getAppPath()}/-/rss?token=${token}`
        : `${window.location.origin}${getAppPath()}/${rssEntity}/-/rss?token=${token}`
      const ok = await shellClipboardWrite(url)
      if (ok) toast.success(t`RSS URL copied to clipboard`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to get RSS token`))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {moderationUrl && (
          <DropdownMenuItem onSelect={() => navigate({ to: moderationUrl })}>
            <Gavel className="size-4" />
            <Trans>Moderation</Trans>
          </DropdownMenuItem>
        )}
        {settingsUrl && (
          <DropdownMenuItem onSelect={() => navigate({ to: settingsUrl })}>
            <Settings className="size-4" />
            <Trans>Settings</Trans>
          </DropdownMenuItem>
        )}
        {rssEntity && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Rss className="me-2 size-4" />
              <Trans>RSS feed</Trans>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => void handleCopyRssUrl('posts')}>
                <Trans>Posts</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}>
                <Trans>Posts and comments</Trans>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {onUnsubscribe && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onUnsubscribe()}
              disabled={unsubscribePending}
            >
              {unsubscribePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserMinus className="size-4" />
              )}
              <Trans>Unsubscribe</Trans>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
