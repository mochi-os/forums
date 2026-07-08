// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Copy, Gavel, Link as LinkIcon, Loader2, MoreHorizontal, Rss, Settings, UserMinus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
  getErrorMessage,
  getAppPath,
  shellClipboardWrite,
  Button,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@mochi/web'
import forumsApi from '@/api/forums'

interface OptionsMenuProps {
  entityId?: string
  showRss?: boolean
  settingsUrl?: string
  moderationUrl?: string
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
  /** Show the 'Link' share-link dialog entry - owner only (the share action is owner-gated). */
  canShare?: boolean
}

export function OptionsMenu({ entityId, showRss, settingsUrl, moderationUrl, onUnsubscribe, unsubscribePending, canShare }: OptionsMenuProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const rssEntity = entityId || (showRss ? '*' : null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const openLinkDialog = async () => {
    if (!entityId) return
    setLink('')
    setCopied(false)
    setLinkOpen(true)
    try {
      const response = await forumsApi.shareForum(entityId)
      setLink(response.data.link)
    } catch (error) {
      setLinkOpen(false)
      toast.error(getErrorMessage(error, t`Failed to create link`))
    }
  }

  const copyLink = async () => {
    if (!link) return
    const ok = await shellClipboardWrite(link)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
    <>
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t`More options`}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t`More options`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {moderationUrl && (
          <DropdownMenuItem onSelect={() => navigate({ to: moderationUrl })}>
            <Gavel className="size-4" />
            <Trans>Moderation</Trans>
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
        {/* Canonical menu tail: Link, Design (n/a here), Settings, Unsubscribe. */}
        {canShare && entityId && (
          <DropdownMenuItem onSelect={() => void openLinkDialog()}>
            <LinkIcon className="size-4" />
            <Trans>Link</Trans>
          </DropdownMenuItem>
        )}
        {settingsUrl && (
          <DropdownMenuItem onSelect={() => navigate({ to: settingsUrl })}>
            <Settings className="size-4" />
            <Trans>Settings</Trans>
          </DropdownMenuItem>
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

    <ResponsiveDialog open={linkOpen} onOpenChange={setLinkOpen}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>Forum link</Trans></ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
          <code className="flex-1 break-all">{link || '…'}</code>
          <Button variant="ghost" size="sm" onClick={() => void copyLink()} disabled={!link} className="shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
    </>
  )
}
