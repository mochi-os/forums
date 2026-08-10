// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  RecommendedEntities,
  toast,
  toastAction,
  getErrorMessage,
} from '@mochi/web'
import { Hash } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { RecommendedForum } from '@/api/types/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface RecommendedForumsProps {
  subscribedIds: Set<string>
  onSubscribe?: () => void
}

export function RecommendedForums({
  subscribedIds,
  onSubscribe,
}: RecommendedForumsProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()

  const load = async (): Promise<RecommendedForum[]> => {
    try {
      const response = await forumsApi.getRecommendations()
      return response.data.forums ?? []
    } catch (error) {
      // The block shows error.message, so the server's own wording has to be
      // pulled out here rather than left inside the axios error.
      throw new Error(
        getErrorMessage(error, t`Failed to load recommended forums`)
      )
    }
  }

  const handleSubscribe = async (forum: RecommendedForum) => {
    const data = await toastAction(
      forumsApi.subscribeForum(forum.id, forum.server || undefined),
      {
        loading: t`Subscribing...`,
        success: false,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      }
    )
    if (data.data?.already_subscribed) {
      toast.info(t`You are already subscribed to this forum`)
    } else {
      toast.success(t`Subscribed to ${forum.name}`)
    }
    void queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    onSubscribe?.()
  }

  return (
    <RecommendedEntities
      subscribedIds={subscribedIds}
      load={load}
      onSubscribe={handleSubscribe}
      icon={Hash}
      title={<Trans>Recommended forums</Trans>}
      errorMessage={t`Failed to load recommended forums`}
      subscribeLabel={t`Subscribe`}
    />
  )
}
