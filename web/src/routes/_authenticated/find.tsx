// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash } from 'lucide-react'
import { FindEntityPage, toastAction, getErrorMessage } from '@mochi/web'
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
    async (forumId: string) => {
      try {
        await toastAction(forumsApi.subscribeForum(forumId), {
          loading: t`Subscribing...`,
          success: t`Subscribed`,
          error: (e) => getErrorMessage(e, t`Failed to subscribe`),
        })
        await queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      } catch {
        // toast already shown
      }
    },
    [queryClient, t]
  )

  return (
    <FindEntityPage
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
