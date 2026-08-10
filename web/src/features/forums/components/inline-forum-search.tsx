// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  InlineEntitySearch,
  toast,
  toastAction,
  getErrorMessage,
} from '@mochi/web'
import { Hash } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { DirectoryEntry } from '@/api/types/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface InlineForumSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

// The directory sends its own hyphenated fingerprint, so the row keeps it
// rather than letting the shared component derive one.
type ForumResult = DirectoryEntry & { subtitle: string }

const withSubtitle = (forum: DirectoryEntry): ForumResult => ({
  ...forum,
  subtitle: forum.fingerprint_hyphens,
})

export function InlineForumSearch({
  subscribedIds,
  onRefresh,
}: InlineForumSearchProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const search = async (query: string): Promise<ForumResult[]> => {
    try {
      const response = await forumsApi.searchForums({ search: query })
      return (response.data.results ?? []).map(withSubtitle)
    } catch (error) {
      // The panel shows error.message, so the server's own wording has to be
      // pulled out here rather than left inside the axios error.
      throw new Error(getErrorMessage(error, t`Failed to search forums`))
    }
  }

  const probe = async (url: string): Promise<ForumResult[]> => {
    const probed = await forumsApi.probeForum({ url })
    const data = probed?.data
    return data?.id
      ? [
          withSubtitle({
            id: data.id,
            name: data.name ?? '',
            fingerprint: data.fingerprint ?? '',
            fingerprint_hyphens: '',
            class: 'forum',
            data: '',
            location: data.server ?? '',
            peer: data.peer,
            created: 0,
            updated: 0,
          }),
        ]
      : []
  }

  const handleSubscribe = async (forum: ForumResult) => {
    const data = await toastAction(
      forumsApi.subscribeForum(
        forum.id,
        forum.location || undefined,
        forum.peer
      ),
      {
        loading: t`Subscribing...`,
        success: false,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      }
    )
    if (data.data?.already_subscribed) {
      toast.info(t`You are already subscribed to this forum`)
    } else {
      toast.success(t`Subscribed`)
    }
    void queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    onRefresh?.()
    void navigate({ to: '/$forum', params: { forum: forum.id } })
  }

  return (
    <InlineEntitySearch
      subscribedIds={subscribedIds}
      search={search}
      probe={probe}
      onSubscribe={handleSubscribe}
      icon={Hash}
      placeholder={t`Search for forums...`}
      emptyMessage={t`No forums found`}
      searchErrorMessage={t`Failed to search forums`}
      subscribeLabel={t`Subscribe`}
    />
  )
}
