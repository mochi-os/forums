// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash } from 'lucide-react'
import { FindEntityPage, toast, toastAction, getErrorMessage } from '@mochi/web'
import { useForumsInfo, forumsKeys } from '@/hooks/use-forums-queries'
import forumsApi from '@/api/forums'
import endpoints from '@/api/endpoints'

export const Route = createFileRoute('/_authenticated/find')({
  component: FindForumsPage,
})

function FindForumsPage() {
  const { t } = useLingui()
  const { data } = useForumsInfo()
  const queryClient = useQueryClient()

  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
    error: recommendationsError,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: forumsKeys.recommendations(),
    queryFn: () => forumsApi.getRecommendations(),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.data?.forums ?? []

  const subscribedForumIds = useMemo(
    () => new Set(
      forums.flatMap((f) => [f.id, f.fingerprint].filter((x): x is string => !!x))
    ),
    [forums]
  )

  const handleSubscribe = useCallback(
    async (forumId: string, entity: { location?: string; peer?: string }) => {
      try {
        const data = await toastAction(
          forumsApi.subscribeForum(forumId, entity.location, entity.peer),
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
        await queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      } catch {
        // toast already shown
      }
    },
    [queryClient, t]
  )

  // Resolve a pasted mochi:// share link to the forum's name via probe, so the
  // card shows the real forum rather than a raw entity id.
  const resolveUri = useCallback(async (url: string) => {
    const response = await forumsApi.probeForum({ url })
    const data = response.data ?? response
    if (!data?.id) return null
    return { ...data, location: data.server ?? '', peer: data.peer }
  }, [])

  return (
    <FindEntityPage
      resolveUri={resolveUri}
      onSubscribe={handleSubscribe}
      subscribedIds={subscribedForumIds}
      entityClass="forum"
      searchEndpoint={endpoints.forums.search}
      icon={Hash}
      iconClassName="bg-primary/10 text-primary"
      title={t`Find forums`}
      placeholder={t`Search by name, ID, fingerprint, or URL...`}
      emptyMessage={t`No forums found`}
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
      recommendationsError={recommendationsError}
      onRetryRecommendations={() => {
        void refetchRecommendations()
      }}
    />
  )
}
